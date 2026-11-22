import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DetectionEventsService } from './detection.events.service.js';
import { DetectionService } from './detection.service.js';
import { DetectionStreamingService } from './detection.streamer.service.js';
import { DeepfaceService } from './providers/deepface/deepface.service.js';
import { FaceMatchService } from './providers/deepface/face-match.service.js';
import { SpeechBrainService } from './providers/speechbrain/speechbrain.service.js';
import { AuthModule } from '#apps/auth/src/auth.module';
import { ChatGPTSentimentAnalysisService } from './providers/sentiment-analysis/sentiment-analysis.llm.service.js';
import { DetectionAsyncApiService } from './detection.async.service.js';
import { WakeWordService } from './providers/wake-word/wake-word.service.js';
import { DetectionController } from './detection.controller.js';
import { EmotionTrackerService } from './providers/emotion-tracker/emotion-tracker.service.js';
import { ChatGPTObjectDetectionService } from './providers/object-detection/object-detection.chatgpt.service.js';

@Module({
  imports: [AuthModule, EventEmitterModule.forRoot()],
  controllers: [DetectionController],
  providers: [
    DeepfaceService,
    FaceMatchService,
    WakeWordService,
    SpeechBrainService,
    ChatGPTSentimentAnalysisService,
    DetectionStreamingService,
    DetectionEventsService,
    DetectionService,
    DetectionAsyncApiService,
    EmotionTrackerService,
    ChatGPTObjectDetectionService,
  ],
  exports: [DetectionService, DetectionStreamingService],
})
export class DetectionModule {}
