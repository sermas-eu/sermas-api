import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformAuthModule } from '../auth/platform.auth.module';
import { PlatformModuleAsyncApiService } from './mod.async.service';
import { PlatformModuleController } from './mod.controller';
import { PlatformModuleProxyController } from './mod.proxy.controller';
import { PlatformModuleProxyService } from './mod.proxy.service';
import { PlatformModuleRegistryService } from './mod.registry.service';
import { PlatformModuleConfig, PlatformModuleConfigSchema } from './mod.schema';
import { PlatformModuleService } from './mod.service';

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
