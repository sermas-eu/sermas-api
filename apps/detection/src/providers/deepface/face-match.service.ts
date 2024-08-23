import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import { VideoFrame, VideoFrameEvent } from '../../detection.streamer.dto';
import { BoundingBox, BoxedFrame } from '../../libs/boxed-frame';
import { DeepFaceDetectionEvent } from './deepface.dto';
import { DeepfaceService } from './deepface.service';
import { FaceMatch, FaceMatchEvent } from './face-match.dto';

@Injectable()
export class FaceMatchService {
  private readonly logger = new Logger(FaceMatchService.name);

  private previousMatch: Record<string, Record<string, FaceMatch>>;

  private minMatchThreshold = 100; // 10fps = 1sec
  private matchThreshold = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly deepface: DeepfaceService,
  ) {}

  public getPreviousMatch(appId: string, cameraId: string): FaceMatch | null {
    if (!this.previousMatch[appId]) {
      return null;
    }
    return this.previousMatch[appId][cameraId] || null;
  }

  public setPreviousMatch(appId: string, cameraId: string, match: FaceMatch) {
    this.previousMatch[appId] = this.previousMatch[appId] || {};
    this.previousMatch[appId][cameraId] = match;
  }

  verify(ev: VideoFrameEvent) {
    const { frame, appId, cameraId } = ev;

    if (!frame.timestamp || !this.previousMatch) return;

    const previousMatch = this.getPreviousMatch(appId, cameraId);

    if (
      previousMatch &&
      frame.timestamp > previousMatch?.detection?.frame?.timestamp
    ) {
      // wait to meet the threshold
      this.matchThreshold++;
      if (this.matchThreshold < this.minMatchThreshold) {
        return;
      }

      this.matchThreshold = 0;
      delete this.previousMatch[appId][cameraId];
      this.logger.log(
        `Removed previous face match on appId=${appId} cameraId=${cameraId}`,
      );
    }
  }

  async matchFaces(detection: DeepFaceDetectionEvent) {
    const { appId, cameraId } = detection;

    const previousMatch = this.getPreviousMatch(appId, cameraId);

    if (!previousMatch) {
      this.setPreviousMatch(appId, cameraId, {
        detection,
        distance: 0.0,
      });
      return;
    }

    const res = await this.deepface.verify(
      detection.frame,
      previousMatch.detection.frame,
    );

    const verified = res.verified === 'True';

    this.logger.log(
      `Face ${verified ? 'is' : 'NOT'} matching distance=${res.distance}`,
    );

    if (verified && previousMatch && previousMatch?.distance < res.distance) {
      this.setPreviousMatch(appId, cameraId, {
        detection,
        distance: res.distance,
      });
    }

    const event = {
      distance: res.distance,
      ...detection,
      frame: null,
      verified,
    } as FaceMatchEvent;

    return event;
  }

  async renderOverlay(ev: VideoFrameEvent): Promise<VideoFrame> {
    const { frame, appId, cameraId } = ev;

    const previousMatch = this.getPreviousMatch(appId, cameraId);

    if (!previousMatch || !previousMatch.detection) {
      return frame;
    }

    const frameWidth = +(this.config.get('FRAME_WIDTH') || 640);
    const frameHeight = +(this.config.get('FRAME_HEIGHT') || 480);

    const width = Math.round(frameWidth / 4);
    const height = Math.round(frameHeight / 4);

    const scaledSample = await sharp(previousMatch?.detection?.frame)
      .resize({
        width: width,
      })
      .toBuffer();

    const boxedFrame = new BoxedFrame(width, height);
    const bbox = new BoundingBox();
    bbox.label = `distance=${this.previousMatch?.distance}`;
    bbox.width = width;
    bbox.height = height;
    bbox.x = 0;
    bbox.labelPosX = 0;
    bbox.labelPosY = 0;

    const overlay = (await sharp(frame)
      .composite([
        { input: scaledSample, gravity: 'southeast' },
        { input: boxedFrame.createOverlay([bbox]), gravity: 'southeast' },
      ])
      .toBuffer()) as VideoFrame;

    overlay.headers = frame.headers;
    overlay.timestamp = frame.timestamp;

    return overlay;
  }
}
