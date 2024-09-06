import { Module } from '@nestjs/common';
import { DialogueIntentEventsService } from './dialogue.intent.events.service';
import { DialogueIntentService } from './dialogue.intent.service';
import { DialogueMemoryModule } from '../memory/dialogue.memory.module';
import { DialogueTaskModule } from '../tasks/dialogue.tasks.module';

@Module({
  imports: [DialogueMemoryModule, DialogueTaskModule],
  controllers: [],
  providers: [DialogueIntentService, DialogueIntentEventsService],
  exports: [DialogueIntentService],
})
export class DialogueIntentModule {}
