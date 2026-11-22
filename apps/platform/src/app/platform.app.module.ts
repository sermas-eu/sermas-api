import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformAuthModule } from '../auth/platform.auth.module.js';
import { PlatformAppClientController } from './client/platform.client.controller.js';
import { PlatformAppClientService } from './client/platform.client.service.js';
import { PlatformAppModuleAsyncApiService } from './mod/app.mod.async.service.js';
import { PlatformAppModuleController } from './mod/app.mod.controller.js';
import { PlatformAppModuleService } from './mod/app.mod.service.js';
import { PlatformAppAdminController } from './platform.app.admin.controller.js';
import { PlatformAppAsyncApiService } from './platform.app.async.service.js';
import { PlatformAppController } from './platform.app.controller.js';
import { PlatformApp, PlatformAppSchema } from './platform.app.schema.js';
import { PlatformAppService } from './platform.app.service.js';
import { DialogueDocumentModule } from '#apps/dialogue/src/document/dialogue.document.module';

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
