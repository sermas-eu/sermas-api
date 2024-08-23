import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { DialogueMemoryController } from './dialogue.memory.controller';
import { DialogueMemoryEventsService } from './dialogue.memory.events.service';
import { DialogueMemory, DialogueMemorySchema } from './dialogue.memory.schema';
import { DialogueMemoryService } from './dialogue.memory.service';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: DialogueMemory.name, schema: DialogueMemorySchema },
    ]),
  ],
  controllers: [DialogueMemoryController],
  providers: [DialogueMemoryService, DialogueMemoryEventsService],
  exports: [DialogueMemoryService],
})
export class DialogueMemoryModule {}
