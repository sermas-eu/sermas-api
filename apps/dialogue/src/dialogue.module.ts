import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'apps/auth/src/auth.module';
import { IdentityTrackerService } from 'apps/detection/src/providers/identify-tracker/identity-tracker.service';
import { SpeechBrainService } from 'apps/detection/src/providers/speechbrain/speechbrain.service';
import { UiModule } from 'apps/ui/src/ui.module';
import { LLMTranslationService } from '../../../libs/translation/translation.service';
import { DialogueChatService } from './chat/dialogue.chat.service';
import { DialogueAsyncApiService } from './dialogue.async.service';
import { DialogueEmotionService } from './dialogue.emotion.service';
import { DialogueRequestMonitorService } from './dialogue.request-monitor.service';
import { DialogueSpeechController } from './dialogue.speech.controller';
import { DialogueSpeechEventService } from './dialogue.speech.events.service';
import { DialogueSpeechService } from './dialogue.speech.service';
import { DialogueWelcomeService } from './dialogue.speech.welcome.service';
import { DialogueDocumentController } from './document/dialogue.document.controller';
import { DialogueDocumentModule } from './document/dialogue.document.module';
import {
  DialogueDocument,
  DialogueDocumentSchema,
} from './document/dialogue.document.schema';
import { DialogueIntentModule } from './intent/dialogue.intent.module';
import { DialogueMemoryModule } from './memory/dialogue.memory.module';
import { DialogueSpeechStreamService } from './speech-stream/dialogue.speech.stream.service';
import { DialogueTaskModule } from './tasks/dialogue.tasks.module';

@Module({
  imports: [
    AuthModule,
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: DialogueDocument.name, schema: DialogueDocumentSchema },
    ]),
    DialogueMemoryModule,
    DialogueTaskModule,
    DialogueDocumentModule,
    DialogueIntentModule,
    UiModule,
  ],
  controllers: [DialogueDocumentController, DialogueSpeechController],
  providers: [
    DialogueAsyncApiService,
    DialogueSpeechService,
    DialogueSpeechEventService,
    DialogueEmotionService,
    LLMTranslationService,
    DialogueChatService,
    DialogueWelcomeService,
    SpeechBrainService,
    IdentityTrackerService,
    DialogueRequestMonitorService,
    DialogueSpeechStreamService,
  ],
  exports: [DialogueSpeechService],
})
export class DialogueModule {}
