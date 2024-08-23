import { Module } from '@nestjs/common';
import { DialogueDocumentModule } from 'apps/dialogue/src/document/dialogue.document.module';
import { DialogueMemoryModule } from 'apps/dialogue/src/memory/dialogue.memory.module';
import { DialogueTaskModule } from 'apps/dialogue/src/tasks/dialogue.tasks.module';
import { SessionModule } from '../session.module';
import { SessionPromptController } from './session.prompt.controller';
import { SessionPromptService } from './session.prompt.service';

@Module({
  imports: [
    SessionModule,
    DialogueMemoryModule,
    DialogueDocumentModule,
    DialogueTaskModule,
  ],
  providers: [SessionPromptService],
  controllers: [SessionPromptController],
  exports: [SessionPromptService],
})
export class SessionPromptModule {}
