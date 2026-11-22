import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { PlatformTopicsModule } from '#apps/platform/src/topics/platform.topics.module';
import { PlatformTopicsService } from '#apps/platform/src/topics/platform.topics.service';
import { isLocalAuth } from '#libs/auth/local/local-auth';
import { KeycloakAdminService } from './keycloak.admin.service.js';
import {
  KeycloakConfigSchema,
  MongoKeycloakConfig,
} from './keycloak.schema.js';
import { KeycloakService } from './keycloak.service.js';
import { LocalKeycloakService } from './local/local-keycloak.service.js';

/** AUTH_PROVIDER=local swaps Keycloak for the API's own token issuer */
const keycloakServiceProvider: Provider = {
  provide: KeycloakService,
  inject: [
    ConfigService,
    KeycloakAdminService,
    PlatformTopicsService,
    getConnectionToken(),
  ],
  useFactory: (
    config: ConfigService,
    admin: KeycloakAdminService,
    topics: PlatformTopicsService,
    connection: Connection,
  ) =>
    isLocalAuth((k) => config.get(k))
      ? new LocalKeycloakService(config, connection, topics)
      : new KeycloakService(config, admin, topics),
};

@Module({
  imports: [
    // AuthModule,
    MongooseModule.forFeature([
      { name: MongoKeycloakConfig.name, schema: KeycloakConfigSchema },
    ]),
    PlatformTopicsModule,
  ],
  controllers: [],
  providers: [KeycloakAdminService, keycloakServiceProvider],
  exports: [KeycloakService, KeycloakAdminService],
})
export class KeycloakModule {}
