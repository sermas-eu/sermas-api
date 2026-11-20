import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DialogueToolsAsyncApiService } from './dialogue.tools.async.service.js';
import { DialogueToolsEventsService } from './dialogue.tools.events.service.js';
import { DialogueToolsService } from './dialogue.tools.service.js';
import {
  DialogueToolsRepository,
  DialogueToolsRepositorySchema,
} from './repository/dialogue.tools.repository.schema.js';
import { DialogueToolsRepositoryService } from './repository/dialogue.tools.repository.service.js';
import { DialogueToolsTriggerService } from './trigger/dialogue.tools.trigger.service.js';
import { DialogueToolsController } from './dialogue.tools.controller.js';

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
