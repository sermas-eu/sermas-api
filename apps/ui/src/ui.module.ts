import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '#apps/auth/src/auth.module';
import { UIModelController } from './model/ui.model.controller.js';
import { UIModelService } from './model/ui.model.service.js';
import { UiPrivacyController } from './privacy/ui.privacy.controller.js';
import { UserPrivacy, UserPrivacySchema } from './privacy/ui.privacy.schema.js';
import { UiPrivacyService } from './privacy/ui.privacy.service.js';
import { UIAssetAdminController } from './ui.asset.admin.controller.js';
import { UIAssetController } from './ui.asset.controller.js';
import { UIAssetService } from './ui.asset.service.js';
import { UIAsyncApiService } from './ui.async.service.js';
import { UIController } from './ui.controller.js';
import { UIService } from './ui.service.js';
import { UIEventsService } from './ui.service.events.js';

@Module({
  imports: [
    AuthModule,
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: UserPrivacy.name, schema: UserPrivacySchema },
    ]),
  ],
  controllers: [
    UIController,
    UIModelController,
    UIAssetController,
    UIAssetAdminController,
    UiPrivacyController,
  ],
  providers: [
    UIAsyncApiService,
    UIModelService,
    UIService,
    UIAssetService,
    UIEventsService,
    UiPrivacyService,
  ],
  exports: [UIService],
})
export class UiModule {}
