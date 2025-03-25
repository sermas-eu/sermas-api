import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  UserCharacterizationEventDto,
  UserCharacterizationEventSource,
} from 'apps/detection/src/detection.dto';
import { Emotion } from 'libs/sermas/sermas.dto';

@Injectable()
export class DialogueEmotionService {
  private readonly logger = new Logger(DialogueEmotionService.name);

  private cache: Record<string, Emotion> = {};

  @OnEvent('detection.user.characterization')
  onCharacaterizationEvent(ev: UserCharacterizationEventDto) {
    if (ev.source !== UserCharacterizationEventSource.emotion_tracker) return;
    if (!ev.sessionId) return;
    if (!ev.detections || !ev.detections.length) return;

    const emotion = ev.detections[0].emotion?.value;
    if (!emotion) return;
    this.cache[ev.sessionId] = emotion;
  }

  getUserEmotion(sessionId: string): Emotion | null {
    const emotion = this.cache[sessionId] || null;
    if (emotion) {
      this.logger.verbose(`Current user emotion: ${emotion}`);
    }
    return emotion;
  }
}
