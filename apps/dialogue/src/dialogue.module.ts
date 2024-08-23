import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'apps/auth/src/auth.module';
import { LLMTranslationService } from '../../../libs/translation/translation.service';
import { DialogueAsyncApiService } from './dialogue.async.service';
import { DialogueChatService } from './dialogue.chat.service';
import { DialogueEmotionService } from './dialogue.emotion.service';
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
import { DialogueIntentEventsService } from './intent/dialogue.intent.events.service';
import { DialogueIntentService } from './intent/dialogue.intent.service';
import { DialogueMemoryModule } from './memory/dialogue.memory.module';
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
  ],
  controllers: [DialogueDocumentController, DialogueSpeechController],
  providers: [
    DialogueAsyncApiService,
    DialogueSpeechService,
    DialogueSpeechEventService,
    DialogueEmotionService,
    LLMTranslationService,
    DialogueChatService,
    DialogueIntentService,
    DialogueIntentEventsService,
    DialogueWelcomeService,
  ],
  exports: [DialogueSpeechService],
})
export class DialogueModule {}
