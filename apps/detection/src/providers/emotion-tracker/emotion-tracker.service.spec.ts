jest.mock('openai');

import { Logger } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { Emotion } from 'libs/sermas/sermas.dto';
import { uuidv4 } from 'libs/util';
import { DetectionAsyncApiService } from '../../detection.async.service';
import { EmotionTrackerService } from './emotion-tracker.service';

jest.setTimeout(10 * 100000);

describe('EmotionTrackerService', () => {
  let moduleRef: TestingModule;

  let emotionTrackerService: EmotionTrackerService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      controllers: [],
      providers: [EmotionTrackerService, DetectionAsyncApiService],
    })
      .overrideProvider(DetectionAsyncApiService)
      .useValue({
        userCharacterization(e: any) {
          e;
          //
        },
      })
      .compile();

    moduleRef.useLogger(new Logger());

    emotionTrackerService = moduleRef.get(EmotionTrackerService);

    await moduleRef.init();
  });
  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  describe('handle events', () => {
    it('should provide a main emotion', async () => {
      const appId = `test-app-${uuidv4()}`;
      const sessionId = `test-session-${uuidv4()}`;

      emotionTrackerService.setCacheTTL(10 * 1000);

      const updateEmotionTracker = (
        value: Emotion,
        probability: number,
        source = 'detector1',
      ) =>
        emotionTrackerService.update({
          appId,
          sessionId,
          detections: [
            {
              emotion: {
                probability,
                value,
              },
            },
          ],
          source,
          ts: new Date(),
        });

      updateEmotionTracker('happy', 0.75, 'vision');
      updateEmotionTracker('happy', 0.9, 'speech');
      updateEmotionTracker('sad', 0.9, 'sentiment_analysis');
      updateEmotionTracker('fear', 0.6, 'sentiment_analysis');
      updateEmotionTracker('fear', 0.4, 'sentiment_analysis');
      updateEmotionTracker('fear', 0.5, 'sentiment_analysis');

      const userEmotion = emotionTrackerService.getEmotion(sessionId);
      expect(userEmotion).not.toBeFalsy();
      expect(userEmotion.emotion).toBe('happy');
      expect(userEmotion.value).toBeLessThanOrEqual(1);
      expect(userEmotion.value).toBeGreaterThanOrEqual(0);
    });
  });
});
