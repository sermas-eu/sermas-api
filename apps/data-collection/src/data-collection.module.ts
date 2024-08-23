import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'apps/auth/src/auth.module';
import { DatasetModule } from 'libs/dataset/src';
import { DataCollectionController } from './data-collection.controller';
import { DataCollectionDatasetService } from './data-collection.dataset.service';
import { DataCollectionEventsService } from './data-collection.events.service';
import {
  DataCollectionSession,
  DataCollectionSessionSchema,
} from './data-collection.schema';
import { DataCollectionService } from './data-collection.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DataCollectionSession.name, schema: DataCollectionSessionSchema },
    ]),
    EventEmitterModule.forRoot(),
    DatasetModule,
    AuthModule,
  ],
  controllers: [DataCollectionController],
  providers: [
    DataCollectionService,
    DataCollectionDatasetService,
    DataCollectionEventsService,
  ],
})
export class DataCollectionModule {}
