import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformTopicsModule } from 'apps/platform/src/topics/platform.topics.module';
import { KeycloakAdminService } from './keycloak.admin.service';
import { KeycloakConfigSchema, MongoKeycloakConfig } from './keycloak.schema';
import { KeycloakService } from './keycloak.service';

@Module({
  imports: [
    // AuthModule,
    MongooseModule.forFeature([
      { name: MongoKeycloakConfig.name, schema: KeycloakConfigSchema },
    ]),
    PlatformTopicsModule,
  ],
  controllers: [],
  providers: [KeycloakAdminService, KeycloakService],
  exports: [KeycloakService, KeycloakAdminService],
})
export class KeycloakModule {}
