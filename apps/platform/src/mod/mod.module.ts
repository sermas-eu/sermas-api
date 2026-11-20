import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformAuthModule } from '../auth/platform.auth.module.js';
import { PlatformModuleAsyncApiService } from './mod.async.service.js';
import { PlatformModuleController } from './mod.controller.js';
import { PlatformModuleProxyController } from './mod.proxy.controller.js';
import { PlatformModuleProxyService } from './mod.proxy.service.js';
import { PlatformModuleRegistryService } from './mod.registry.service.js';
import {
  PlatformModuleConfig,
  PlatformModuleConfigSchema,
} from './mod.schema.js';
import { PlatformModuleService } from './mod.service.js';

@Module({
  imports: [
    PlatformAuthModule,
    MongooseModule.forFeature([
      { name: PlatformModuleConfig.name, schema: PlatformModuleConfigSchema },
    ]),
  ],
  controllers: [PlatformModuleController, PlatformModuleProxyController],
  providers: [
    PlatformModuleAsyncApiService,
    PlatformModuleService,
    PlatformModuleProxyService,
    PlatformModuleRegistryService,
  ],
})
export class PlatformModuleModule {}
