import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UiModule } from '#apps/ui/src/ui.module';
import { DialogueMemoryModule } from '../memory/dialogue.memory.module.js';
import { DialogueToolsModule } from '../tools/dialogue.tools.module.js';
import { DialogueTasksAsyncApiService } from './dialogue.tasks.async.service.js';
import { DialogueTaskController } from './dialogue.tasks.controller.js';
import { DialogueTasksEventsService } from './dialogue.tasks.events.service.js';
import { DialogueTasksHandlerFieldsService } from './dialogue.tasks.handler.fields.service.js';
import { DialogueTasksHandlerService } from './dialogue.tasks.handler.service.js';
import { DialogueTasksService } from './dialogue.tasks.service.js';
import {
  DialogueTaskRecord,
  DialogueTaskRecordSchema,
} from './record/dialogue.tasks.record.schema.js';
import { DialogueTaskRecordService } from './record/dialogue.tasks.record.service.js';
import {
  DialogueTaskStore,
  DialogueTaskStoreSchema,
} from './store/dialogue.tasks.store.schema.js';
import { DialogueTaskStoreService } from './store/dialogue.tasks.store.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DialogueTaskStore.name,
        schema: DialogueTaskStoreSchema,
      },
      {
        name: DialogueTaskRecord.name,
        schema: DialogueTaskRecordSchema,
      },
    ]),
    DialogueToolsModule,
    DialogueMemoryModule,
    UiModule,
  ],
  controllers: [DialogueTaskController],
  providers: [
    DialogueTaskRecordService,
    DialogueTaskStoreService,
    DialogueTasksService,
    DialogueTasksEventsService,
    DialogueTasksHandlerService,
    DialogueTasksHandlerFieldsService,
    DialogueTasksAsyncApiService,
  ],
  exports: [
    DialogueTasksService,
    DialogueToolsModule,
    DialogueTaskRecordService,
    DialogueTasksHandlerService,
  ],
})
export class DialogueTaskModule {}
