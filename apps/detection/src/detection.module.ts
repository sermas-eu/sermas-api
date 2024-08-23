import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DetectionEventsService } from './detection.events.service';
import { DetectionService } from './detection.service';
import { DetectionStreamingService } from './detection.streamer.service';
import { DeepfaceService } from './providers/deepface/deepface.service';
import { FaceMatchService } from './providers/deepface/face-match.service';
import { SpeechBrainService } from './providers/speechbrain/speechbrain.service';
import { AuthModule } from 'apps/auth/src/auth.module';
import { ChatGPTSentimentAnalysisService } from './providers/sentiment-analysis/sentiment-analysis.chatgpt.service';
import { DetectionAsyncApiService } from './detection.async.service';
import { WakeWordService } from './providers/wake-word/wake-word.service';
import { DetectionController } from './detection.controller';
import { EmotionTrackerService } from './providers/emotion-tracker/emotion-tracker.service';
import { ChatGPTObjectDetectionService } from './providers/object-detection/object-detection.chatgpt.service';

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
