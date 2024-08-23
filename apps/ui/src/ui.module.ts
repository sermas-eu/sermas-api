import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from 'apps/auth/src/auth.module';
import { UIModelController } from './model/ui.model.controller';
import { UIModelService } from './model/ui.model.service';
import { UIAssetAdminController } from './ui.asset.admin.controller';
import { UIAssetController } from './ui.asset.controller';
import { UIAssetService } from './ui.asset.service';
import { UIAsyncApiService } from './ui.async.service';
import { UIController } from './ui.controller';
import { UIService } from './ui.service';
import { UIEventsService } from './ui.service.events';
import { UiPrivacyController } from './privacy/ui.privacy.controller';
import { UiPrivacyService } from './privacy/ui.privacy.service';
import { UserPrivacy, UserPrivacySchema } from './privacy/ui.privacy.schema';
import { MongooseModule } from '@nestjs/mongoose';

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
})
export class UiModule {}
