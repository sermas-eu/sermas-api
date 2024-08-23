import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DialogueToolsAsyncApiService } from './dialogue.tools.async.service';
import { DialogueToolsEventsService } from './dialogue.tools.events.service';
import { DialogueToolsService } from './dialogue.tools.service';
import {
  DialogueToolsRepository,
  DialogueToolsRepositorySchema,
} from './repository/dialogue.tools.repository.schema';
import { DialogueToolsRepositoryService } from './repository/dialogue.tools.repository.service';
import { DialogueToolsTriggerService } from './trigger/dialogue.tools.trigger.service';
import { DialogueToolsController } from './dialogue.tools.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DialogueToolsRepository.name,
        schema: DialogueToolsRepositorySchema,
      },
    ]),
  ],
  controllers: [DialogueToolsController],
  providers: [
    DialogueToolsService,
    DialogueToolsEventsService,
    DialogueToolsAsyncApiService,
    DialogueToolsTriggerService,
    DialogueToolsRepositoryService,
  ],
  exports: [DialogueToolsService],
})
export class DialogueToolsModule {}
