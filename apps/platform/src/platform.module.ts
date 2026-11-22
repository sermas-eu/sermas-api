import { Global, Module } from '@nestjs/common';
import { KeycloakModule } from '#apps/keycloak/src/keycloak.module';
import { MqttModule } from '#libs/mqtt-handler/mqtt.module';
import { AuthJwtModule } from '#libs/auth/auth.module';
import { PlatformAppClientService } from './app/client/platform.client.service.js';
import { PlatformAppModule } from './app/platform.app.module.js';
import { PlatformAuthModule } from './auth/platform.auth.module.js';
import { PlatformTokenAsyncApiService } from './auth/platform.token.async.service.js';
import { PlatformModuleModule } from './mod/mod.module.js';
import { PlatformKeycloakService } from './platform.keycloack.service.js';
import { LocalPlatformKeycloakService } from './local/local-platform-keycloak.service.js';
import { ConfigService } from '@nestjs/config';
import { KeycloakService } from '#apps/keycloak/src/keycloak.service';
import type { LocalKeycloakService } from '#apps/keycloak/src/local/local-keycloak.service';
import { isLocalAuth } from '#libs/auth/local/local-auth';
import { PlatformAppAsyncApiService } from './app/platform.app.async.service.js';
import { PlatformController } from './platform.settings.controller.js';
import { PlatformSettingsService } from './platform.settings.service.js';
import { PlatformWellKnownController } from './platform.well-known.controller.js';
import { PlatformTopicsModule } from './topics/platform.topics.module.js';

@Global()
@Module({
  imports: [
    PlatformTopicsModule,
    KeycloakModule,
    MqttModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('MQTT_URL'),
        // password: configService.get<string>('MQTT_PASSWORD'),
        keycloakUrl: configService.get<string>('AUTH_KEYCLOAK_URL'),
        keycloakRealm: configService.get<string>('AUTH_KEYCLOAK_REALM'),
        keycloakServiceAccountClientId: configService.get<string>(
          'AUTH_KEYCLOAK_CLIENT_ID',
        ),
        keycloakClientSecret: configService.get<string>('AUTH_KEYCLOAK_SECRET'),
        keycloakServiceAccountUsername: null,
        keycloakServiceAccountPassword: null,
      }),
    }),
    AuthJwtModule,
    PlatformAuthModule,
    PlatformAppModule,
    PlatformModuleModule,
  ],
  controllers: [PlatformController, PlatformWellKnownController],
  providers: [
    {
      provide: PlatformKeycloakService,
      inject: [ConfigService, KeycloakService, PlatformAppAsyncApiService],
      useFactory: (
        config: ConfigService,
        keycloak: KeycloakService,
        asyncApi: PlatformAppAsyncApiService,
      ) =>
        isLocalAuth((k) => config.get(k))
          ? new LocalPlatformKeycloakService(
              config,
              keycloak as unknown as LocalKeycloakService,
              asyncApi,
            )
          : new PlatformKeycloakService(config, keycloak, asyncApi),
    },
    PlatformSettingsService,
    PlatformAppClientService,
    PlatformTokenAsyncApiService,
  ],
  exports: [
    PlatformAuthModule,
    PlatformAppModule,

    KeycloakModule,
    AuthJwtModule,

    PlatformKeycloakService,
  ],
})
export class PlatformModule {}
