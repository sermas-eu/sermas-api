import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformAuthModule } from '../auth/platform.auth.module';
import { PlatformAppClientController } from './client/platform.client.controller';
import { PlatformAppClientService } from './client/platform.client.service';
import { PlatformAppModuleAsyncApiService } from './mod/app.mod.async.service';
import { PlatformAppModuleController } from './mod/app.mod.controller';
import { PlatformAppModuleService } from './mod/app.mod.service';
import { PlatformAppAdminController } from './platform.app.admin.controller';
import { PlatformAppAsyncApiService } from './platform.app.async.service';
import { PlatformAppController } from './platform.app.controller';
import { PlatformApp, PlatformAppSchema } from './platform.app.schema';
import { PlatformAppService } from './platform.app.service';
import { DialogueDocumentModule } from 'apps/dialogue/src/document/dialogue.document.module';

@Module({
  imports: [
    PlatformAuthModule,
    DialogueDocumentModule,
    MongooseModule.forFeature([
      { name: PlatformApp.name, schema: PlatformAppSchema },
    ]),
  ],
  controllers: [
    PlatformAppController,
    PlatformAppAdminController,
    PlatformAppClientController,
    PlatformAppModuleController,
  ],
  providers: [
    PlatformAppService,
    PlatformAppAsyncApiService,
    PlatformAppClientService,
    PlatformAppModuleAsyncApiService,
    PlatformAppModuleService,
  ],
  exports: [PlatformAppService, PlatformAppAsyncApiService],
})
export class PlatformAppModule {}
