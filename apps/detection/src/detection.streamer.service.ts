import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs/promises';
import { Socket } from 'net';
import { Transform, TransformCallback } from 'stream';
import { DetectionService } from './detection.service';
import {
  CameraConfig,
  CameraHandler,
  DetectionStreamerRequest,
  VideoFrame,
  VideoFrameEvent,
} from './detection.streamer.dto';
import { MJPEG_BOUNDARY } from './libs/constants';
import { toMjpegBuffer } from './libs/mjpeg';
import { MjpegConsumer } from './libs/mjpeg-consumer';
import { DeepFaceDetectionEvent } from './providers/deepface/deepface.dto';

@Injectable()
export class DetectionStreamingService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DetectionStreamingService.name);

  private readonly cameraHandlers: Record<
    string,
    Record<string, CameraHandler>
  > = {};

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly detection: DetectionService,
  ) {}

  getCameraHandlers() {
    return this.cameraHandlers;
  }

  async onModuleDestroy() {
    if (!this.cameraHandlers) return;
    Object.keys(this.cameraHandlers || {}).forEach((appId) => {
      Object.keys(this.cameraHandlers[appId] || {}).forEach((cameraId) => {
        const camera = this.cameraHandlers[appId][cameraId];
        camera.socket.end();
        (camera.clients || []).forEach((client) => {
          client.res?.end();
        });
      });
    });
  }

  async onModuleInit() {
    if (
      process.env.STREAMING_ENABLED === '0' ||
      !process.env.STREAMING_ENABLED
    ) {
      this.logger.warn('stream is disabled. Enable with STREAMING_ENABLED=1');
      return;
    }

    const cameraConfig = await this.loadCameraConfig();
    if (cameraConfig === null) return;

    this.startStream(cameraConfig);
  }

  async loadCameraConfig(): Promise<CameraConfig[] | null> {
    const configPath = process.env.CAMERA_CONFIG || '/app/config/camera.json';
    try {
      const raw = (await fs.readFile(configPath)).toString();
      const config = JSON.parse(raw) as CameraConfig[];
      if (config.length === 0) {
        this.logger.warn(`Camera config is empty at ${configPath}`);
        return null;
      }
      return config;
    } catch (e) {
      this.logger.error(
        `Failed to load camera config at ${configPath}: ${e.stack}`,
      );
    }
    return null;
  }

  async startStream(cameras: CameraConfig[]) {
    const reconnectTime = +(process.env.RECONNECT_TIME || 5);

    const initSocket = (camera: CameraConfig) => {
      let restarting = false;

      const { cameraId, appId, port } = camera;

      this.cameraHandlers[appId] = this.cameraHandlers[appId] || {};

      if (this.cameraHandlers[appId][cameraId]) {
        this.cameraHandlers[appId][cameraId].clients.map((c) => c.res.end());
        this.cameraHandlers[appId][cameraId].socket.end();
        delete this.cameraHandlers[appId][cameraId];
      }

      const socket = new Socket();

      socket.on('restart', () => {
        if (restarting) return;
        restarting = true;

        try {
          socket.end();
          socket.removeAllListeners();
          socket.unpipe();
          socket.destroy();
        } catch (e) {
          //
        }

        // console.log(`Reconnecting to ${id} in ${reconnectTime} seconds`);

        if (process.env.NODE_ENV !== 'production') {
          this.logger.warn('Reconnect disabled in dev');
          return;
        }

        setTimeout(() => {
          initSocket(camera);
          restarting = false;
        }, reconnectTime * 1000);
      });

      socket.on('connect', () => {
        this.logger.log(
          `Connected to streamer ${process.env.STREAMING_URL}:${port} cameraId=${cameraId}`,
        );
      });

      socket.on('close', () => {
        this.logger.log(`Socket closed on ${port} cameraId=${cameraId}`);
        socket.emit('restart');
      });

      socket.on('end', () => {
        this.logger.log(`Socket ended on ${port} cameraId=${cameraId}`);
        socket.emit('restart');
      });

      socket.on('error', (e) => {
        this.logger.error(`Error ${e.stack} cameraId=${cameraId}`);
        socket.emit('restart');
      });

      socket.connect(port, process.env.STREAMING_URL);

      const _send = (chunk: Buffer) => {
        this.cameraHandlers[appId][cameraId].clients.forEach((client) => {
          //if drained internal buffer is free
          if (!client.drained) {
            return;
          }
          client.drained = client.res.write(chunk);
        });
      };

      socket
        .pipe(new MjpegConsumer())
        .pipe(
          new Transform({
            transform: (
              frame: VideoFrame,
              encoding: BufferEncoding,
              done: TransformCallback,
            ) => {
              this.emitter.emit('detection.streamer.frame', {
                appId,
                cameraId,
                frame,
              } as VideoFrameEvent);

              const headers = Buffer.from(
                [
                  `--${MJPEG_BOUNDARY}`,
                  `timestamp:  ${frame.timestamp}`,
                  'Content-Type: image/jpeg',
                  `Content-length: ${frame.length}`,
                  '\r\n',
                ].join('\r\n'),
              );

              done(null, Buffer.concat([headers, frame]));
            },
          }),
        )
        .on('data', _send);

      const cameraHandler: CameraHandler = {
        clients: [],
        port,
        socket,
      };
      this.cameraHandlers[appId][cameraId] = cameraHandler;
    };
    cameras.forEach(initSocket);
  }

  async serve(req: DetectionStreamerRequest): Promise<void> {
    const { res, overlay, cameraId, appId } = req;

    // TODO: handle  more cameras ?
    this.logger.log(`Serving client on cameraId=${cameraId} appId=${appId}`);

    let closed = false;
    let bufferEmpty = true;
    let processingFrame = false;

    const _sendFrame = (frame: VideoFrame) => {
      bufferEmpty = res.write(toMjpegBuffer(frame));
    };

    const _write = async (arg: DeepFaceDetectionEvent | VideoFrameEvent) => {
      // skip if channel is closed
      if (closed) return;

      // skip if appId/cameraId does not match
      if (cameraId !== arg.cameraId || appId !== arg.appId) return null;

      // write again only if buffer is empty
      if (!bufferEmpty) return;

      const isDetection =
        (arg as DeepFaceDetectionEvent).detections !== undefined;

      // skip box rendering
      if (!isDetection) {
        const { frame } = arg as VideoFrameEvent;
        _sendFrame(frame);
        return;
      }

      const detectionEvent = arg as DeepFaceDetectionEvent;
      const { frame, detections } = detectionEvent;

      if (processingFrame || !frame) {
        return;
      }

      if (!detections || !detections.length) {
        _sendFrame(frame);
        return;
      }

      processingFrame = true;

      try {
        const outputFrame = await this.detection.renderOverlay(detectionEvent);
        _sendFrame(outputFrame);
      } finally {
        processingFrame = false;
      }
    };

    this.emitter.on(
      overlay ? 'detection.face.detected' : 'detection.streamer.frame',
      _write,
    );

    res.on('drain', () => {
      bufferEmpty = true;
    });
    res.on('close', () => {
      closed = true;
      this.emitter.off(
        overlay ? 'detection.face.detected' : 'detection.streamer.frame',
        _write,
      );
      this.logger.log(`Client disconnected from cameraId=${cameraId}`);
    });
  }
}
