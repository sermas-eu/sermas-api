import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionStorageAsyncApiService } from './session.storage.async.service';
import { SessionStorageController } from './session.storage.controller';
import { SessionStorage, SessionStorageSchema } from './session.storage.schema';
import { SessionStorageService } from './session.storage.service';

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
