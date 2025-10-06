import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { DetectionAsyncApiService } from '../../detection.async.service';
import {
  UserCharacterizationEventDto,
  UserCharacterizationEventSource,
} from '../../detection.dto';
import { EmotionRecord } from './emotion-tracker.dto';

interface CachedUserCharacterizationEventDto
  extends UserCharacterizationEventDto {
  ts: Date;
}

// Keep the detected emotion reference for EMOTION_LIFESPAN
export const EMOTION_LIFESPAN = 30 * 1000;

@Injectable()
export class EmotionTrackerService {
  private readonly logger = new Logger(EmotionTrackerService.name);

  private timerLength = EMOTION_LIFESPAN;
  private timer: NodeJS.Timeout;

  private threshold = 0.5;
  private ttl = 5000;
  private cache: Record<string, CachedUserCharacterizationEventDto[]> = {};

  private records: Record<string, EmotionRecord> = {};

  private readonly enabled: boolean;

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly asyncApi: DetectionAsyncApiService,
    private readonly config: ConfigService,
  ) {
    this.enabled = this.config.get('ENABLE_EMOTION_RECOGNITION') === '1';
    if (!this.enabled) {
      this.logger.warn(
        'Emotion tracker is disabled. Enable with ENABLE_EMOTION_RECOGNITION=1',
      );
    }
  }

  getEmotion(sessionId: string): EmotionRecord | null {
    return this.records[sessionId] || null;
  }

  setCacheTTL(ttl: number) {
    this.ttl = ttl;
  }

  @Interval(10000)
  clear() {
    if (!this.enabled) return;

    Object.keys(this.cache).forEach((sessionId) => {
      this.cache[sessionId] = this.cache[sessionId] || [];
      if (this.cache[sessionId].length > 10) {
        this.cache[sessionId].splice(this.cache[sessionId].length - 10);
      }
      this.cache[sessionId] = this.cache[sessionId].filter(
        (el) => el.ts && Date.now() - el.ts.getTime() < this.ttl,
      );
    });
  }

  avg(values: number[]) {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  update(ev: UserCharacterizationEventDto) {
    if (!this.enabled) return;

    if (!ev.sessionId) return;
    // skip self-processed events
    if (ev.source === UserCharacterizationEventSource.emotion_tracker) return;

    ev.ts = ev.ts ? new Date(ev.ts) : new Date();

    this.cache[ev.sessionId] = this.cache[ev.sessionId] || [];
    this.cache[ev.sessionId].push(ev as CachedUserCharacterizationEventDto);

    // this.logger.debug(`Added record ${ev.source}`);

    this.clear();
    this.process();
  }

  normalize(values: number[]) {
    const total = values.reduce((sum, v) => sum + v, 0);
    return values.map((value) => value / total);
  }

  // Weighted Averaging
  weightedAverage(outputs: number[], normalizedScores: number[]): number {
    if (outputs.length !== normalizedScores.length) {
      throw new Error('Input arrays must have the same length');
    }

    const weightedSum = outputs.reduce((sum, output, index) => {
      return sum + output * normalizedScores[index];
    }, 0);

    return weightedSum;
  }

  softmaxWeighting(outputs: number[], normalizedScores: number[]): number[] {
    if (outputs.length !== normalizedScores.length) {
      throw new Error('Input arrays must have the same length');
    }

    const exponentials = outputs.map((output, index) => {
      return Math.exp(output * normalizedScores[index]);
    });

    const sumOfExponentials = exponentials.reduce((sum, exponential) => {
      return sum + exponential;
    }, 0);

    const softmaxWeightedOutputs = exponentials.map((exponential) => {
      return exponential / sumOfExponentials;
    });

    return softmaxWeightedOutputs;
  }

  process() {
    if (!this.enabled) return;

    Object.keys(this.cache).forEach((sessionId) => {
      const emotions: Record<string, number> = {};

      // collect all values by emotion
      const cacheItems = this.cache[sessionId];

      // skip if there is only one source
      if (cacheItems.length === 0) return;

      cacheItems.forEach((ev) => {
        ev.detections.forEach((inference) => {
          if (!inference.emotion) return;
          if (emotions[inference.emotion.value] === undefined) {
            emotions[inference.emotion.value] = 0;
          }
          emotions[inference.emotion.value] += inference.emotion.probability;
        });
      });

      const keys = Object.keys(emotions);
      if (!keys.length) return;

      const values = keys.map((label) => emotions[label]);

      const normalized = this.normalize(values);
      const softmax = this.softmaxWeighting(values, normalized);

      // keys.forEach((emotionLabel, i) => {
      //   this.logger.debug(
      //     `emotion=${emotionLabel} softmax=${softmax[i]} values=${values[i]} normalized=${normalized[i]}`,
      //   );
      // });

      const records = softmax
        .map((value, i) => {
          return {
            appId: cacheItems[0].appId,
            emotion: keys[i],
            ts: new Date(),
            value,
            sessionId,
          } as EmotionRecord;
        })
        .sort((a, b) => (a.value < b.value ? 1 : -1));

      // best match on softmax
      const record: EmotionRecord = records[0];
      if (record.value < this.threshold) {
        return;
      }

      const currentEmotion = this.getEmotion(sessionId);
      if (currentEmotion) {
        if (currentEmotion.emotion === record.emotion) return;
        if (currentEmotion.value > record.value) return;
      }

      this.records[sessionId] = record;
      this.emitChanges(record);
    });
  }

  private emitChanges(emotion: EmotionRecord) {
    this.logger.debug(
      `Emotion changed ${emotion.emotion}=${emotion.value} appId=${emotion.appId} sessionId=${emotion.sessionId}`,
    );

    const userCharacterizationEventDto: UserCharacterizationEventDto = {
      appId: emotion.appId,
      sessionId: emotion.sessionId,
      clientId: null,
      ts: new Date(),
      detections: [
        {
          emotion: {
            value: emotion.emotion,
            probability: emotion.value,
          },
        },
      ],
      source: UserCharacterizationEventSource.emotion_tracker,
    };

    this.emitter.emit(
      'detection.user.characterization',
      userCharacterizationEventDto,
    );
    this.asyncApi.userCharacterization(userCharacterizationEventDto);

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.cache[emotion.sessionId] = [];

      const current = this.getEmotion(emotion.sessionId);
      // do not repeat emit if already set
      if (current.emotion === 'neutral') return;

      const neutralEmotion: EmotionRecord = {
        ...emotion,
        emotion: 'neutral',
        value: this.threshold + 0.1,
      };

      this.records[emotion.sessionId] = neutralEmotion;
      this.emitChanges(neutralEmotion);

      // this.logger.debug(
      //   `Reset main emotion appId=${emotion.appId} sessionId=${emotion.sessionId}`,
      // );
    }, this.timerLength);
  }
}
