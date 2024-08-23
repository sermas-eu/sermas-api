import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DialogueMemoryModule } from '../memory/dialogue.memory.module';
import { DialogueToolsModule } from '../tools/dialogue.tools.module';
import { DialogueTasksAsyncApiService } from './dialogue.tasks.async.service';
import { DialogueTaskController } from './dialogue.tasks.controller';
import { DialogueTasksEventsService } from './dialogue.tasks.events.service';
import { DialogueTasksHandlerFieldsService } from './dialogue.tasks.handler.fields.service';
import { DialogueTasksHandlerService } from './dialogue.tasks.handler.service';
import { DialogueTasksService } from './dialogue.tasks.service';
import {
  DialogueTaskRecord,
  DialogueTaskRecordSchema,
} from './record/dialogue.tasks.record.schema';
import { DialogueTaskRecordService } from './record/dialogue.tasks.record.service';
import {
  DialogueTaskStore,
  DialogueTaskStoreSchema,
} from './store/dialogue.tasks.store.schema';
import { DialogueTaskStoreService } from './store/dialogue.tasks.store.service';

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
  ],
})
export class DialogueTaskModule {}
