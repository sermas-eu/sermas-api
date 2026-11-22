import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { DialogueMemoryController } from './dialogue.memory.controller.js';
import { DialogueMemoryEventsService } from './dialogue.memory.events.service.js';
import {
  DialogueMemory,
  DialogueMemorySchema,
} from './dialogue.memory.schema.js';
import { DialogueMemoryService } from './dialogue.memory.service.js';
import { DialogueMemorySummaryService } from './dialogue.memory.summary.service.js';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: DialogueMemory.name, schema: DialogueMemorySchema },
    ]),
  ],
  controllers: [DialogueMemoryController],
  providers: [
    DialogueMemoryService,
    DialogueMemoryEventsService,
    DialogueMemorySummaryService,
  ],
  exports: [DialogueMemoryService],
})
export class DialogueMemoryModule {}
