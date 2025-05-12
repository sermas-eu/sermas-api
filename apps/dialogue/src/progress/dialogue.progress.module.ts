import { Module } from '@nestjs/common';
import { DialogueProgressAsyncService } from './dialogue.progress.async.service';

@Module({
  imports: [],
  controllers: [],
  providers: [DialogueProgressAsyncService],
  exports: [DialogueProgressAsyncService],
})
export class DialogueProgressModule {}
