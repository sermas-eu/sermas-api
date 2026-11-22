import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { EventEmitterModule } from '@nestjs/event-emitter';
import { MonitoringAsyncApiService } from './monitoring.async.service.js';
import { MonitoringDatasetController } from './monitoring.dataset.controller.js';
import { MonitoringDatasetEventsService } from './monitoring.dataset.events.service.js';
import {
  DatasetRecord,
  DatasetRecordSchema,
} from './monitoring.dataset.schema.js';
import { MonitoringDatasetService } from './monitoring.dataset.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DatasetRecord.name, schema: DatasetRecordSchema },
    ]),
    ConfigModule,
    EventEmitterModule,
  ],
  providers: [
    MonitoringDatasetService,
    MonitoringDatasetEventsService,
    MonitoringAsyncApiService,
  ],
  controllers: [MonitoringDatasetController],
  exports: [MonitoringDatasetService],
})
export class MonitoringDatasetModule {}
