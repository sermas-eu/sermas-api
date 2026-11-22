import { Module } from '@nestjs/common';
import { DialogueIntentEventsService } from './dialogue.intent.events.service.js';
import { DialogueIntentService } from './dialogue.intent.service.js';
import { DialogueMemoryModule } from '../memory/dialogue.memory.module.js';
import { DialogueTaskModule } from '../tasks/dialogue.tasks.module.js';

@Module({
  imports: [DialogueMemoryModule, DialogueTaskModule],
  controllers: [],
  providers: [DialogueIntentService, DialogueIntentEventsService],
  exports: [DialogueIntentService],
})
export class DialogueIntentModule {}
