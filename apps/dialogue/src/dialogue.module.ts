import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '#apps/auth/src/auth.module';
import { IdentityTrackerService } from '#apps/detection/src/providers/identify-tracker/identity-tracker.service';
import { SpeechBrainService } from '#apps/detection/src/providers/speechbrain/speechbrain.service';
import { UiModule } from '#apps/ui/src/ui.module';
import { LLMTranslationService } from '../../../libs/translation/translation.service.js';
import { DialogueChatService } from './chat/dialogue.chat.service.js';
import { DialogueAsyncApiService } from './dialogue.async.service.js';
import { DialogueEmotionService } from './dialogue.emotion.service.js';
import { DialogueRequestMonitorService } from './dialogue.request-monitor.service.js';
import { DialogueSpeechController } from './dialogue.speech.controller.js';
import { DialogueSpeechEventService } from './dialogue.speech.events.service.js';
import { DialogueSpeechService } from './dialogue.speech.service.js';
import { DialogueWelcomeService } from './dialogue.speech.welcome.service.js';
import { DialogueDocumentController } from './document/dialogue.document.controller.js';
import { DialogueDocumentModule } from './document/dialogue.document.module.js';
import {
  DialogueDocument,
  DialogueDocumentSchema,
} from './document/dialogue.document.schema.js';
import { DialogueIntentModule } from './intent/dialogue.intent.module.js';
import { DialogueMemoryModule } from './memory/dialogue.memory.module.js';
import { DialogueSpeechStreamService } from './speech-stream/dialogue.speech.stream.service.js';
import { DialogueTaskModule } from './tasks/dialogue.tasks.module.js';

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
