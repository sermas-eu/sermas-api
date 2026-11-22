import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionStorageAsyncApiService } from './session.storage.async.service.js';
import { SessionStorageController } from './session.storage.controller.js';
import {
  SessionStorage,
  SessionStorageSchema,
} from './session.storage.schema.js';
import { SessionStorageService } from './session.storage.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SessionStorage.name, schema: SessionStorageSchema },
    ]),
  ],
  providers: [SessionStorageService, SessionStorageAsyncApiService],
  controllers: [SessionStorageController],
  exports: [SessionStorageService],
})
export class SessionStorageModule {}
