import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios, { AxiosError, isAxiosError } from 'axios';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { VideoFrame, VideoFrameEvent } from '../../detection.streamer.dto';
import { BoundingBox, BoxedFrame } from '../../libs/boxed-frame';
import {
  DeepFaceAnalyzeDto,
  DeepFaceAnalyzeItemDto,
  DeepFaceAnalyzeResponseDto,
  DeepFaceBackend,
  DeepFaceDetectionEvent,
  DeepFaceMetric,
  DeepFaceModel,
  DeepFaceVerifyDto,
  DeepFaceVerifyResultDto,
} from './deepface.dto';

@Injectable()
export class DeepfaceService {
  private readonly logger = new Logger(DeepfaceService.name);

  private processing = false;

  private readonly boxedFrame: BoxedFrame;

  constructor(
    private eventEmitter: EventEmitter2,
    private config: ConfigService,
    @Inject(MqttService) private readonly mqttService: MqttService,
  ) {
    this.boxedFrame = new BoxedFrame(
      +(this.config.get('FRAME_WIDTH') || 640),
      +(this.config.get('FRAME_HEIGHT') || 480),
    );
  }

  toBase64(frame: VideoFrame): string {
    const b64 = Buffer.from(frame).toString('base64');
    return 'data:image/jpg;base64,'.concat(b64);
  }

  async verify(
    frame: VideoFrame,
    previousFrame: VideoFrame,
    model_name: DeepFaceModel = 'VGG-Face',
    detector_backend: DeepFaceBackend = 'opencv',
    distance_metric: DeepFaceMetric = 'cosine',
    enforce_detection = false,
  ): Promise<DeepFaceVerifyResultDto | null> {
    const payload: DeepFaceVerifyDto = {
      img1_path: this.toBase64(frame),
      img2_path: this.toBase64(previousFrame),
      model_name,
      detector_backend,
      distance_metric,
      enforce_detection,
    };

    try {
      const res = await axios.post(
        `${process.env.DEEPFACE_URL}/verify`,
        payload,
      );

      if (!res.data) {
        // this.logger.warn(`Got empty response from deepface`);
        return null;
      }

      return res.data;
    } catch (err) {
      if (isAxiosError(err)) {
        const axiosError = err as AxiosError;
        if (axiosError?.response?.status !== 500)
          this.logger.warn(`Request failed: ${axiosError.stack}`);
      }
      return null;
    }
  }

  async detect(frame: VideoFrame): Promise<DeepFaceAnalyzeItemDto[] | null> {
    if (this.processing) return null;
    try {
      this.processing = true;
      const payload: DeepFaceAnalyzeDto = {
        img_path: this.toBase64(frame),
        enforce_detection: true,
      };

      const res = await axios.post(
        `${process.env.DEEPFACE_URL}/analyze`,
        payload,
      );

      if (!res.data) {
        // this.logger.warn(`Got empty response from deepface`);
        return null;
      }

      //NOTE: returning just one match
      const analyze: DeepFaceAnalyzeResponseDto = res.data;
      return analyze.results ? analyze.results : null;
    } catch (err) {
      if (isAxiosError(err)) {
        const axiosError = err as AxiosError;
        if (axiosError?.response?.status !== 500)
          this.logger.warn(`Request failed: ${axiosError.stack}`);
      }
    } finally {
      this.processing = false;
    }
    return null;
  }

  renderBoundingBoxes(ev: DeepFaceDetectionEvent): Promise<VideoFrame> {
    const { frame, detections } = ev;
    const bboxes = detections
      .filter((d) => !d.region)
      .map((detection) => {
        const bbox = new BoundingBox();
        bbox.label = `emotion=${detection.dominant_emotion} age=${detection.age} gender=${detection.dominant_gender} ethnicity=${detection.dominant_race}`;
        bbox.x = detection.region.x;
        bbox.y = detection.region.y;
        bbox.width = detection.region.w;
        bbox.height = detection.region.h;
        return bbox;
      });

    return this.boxedFrame.draw(frame, bboxes);
  }
}
