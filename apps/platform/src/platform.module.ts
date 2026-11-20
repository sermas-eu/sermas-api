import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KeycloakModule } from 'apps/keycloak/src/keycloak.module';
import { MqttModule } from 'libs/mqtt-handler/mqtt.module';
import { AuthJwtModule } from 'libs/auth/auth.module';
import { PlatformAppClientService } from './app/client/platform.client.service';
import { PlatformAppModule } from './app/platform.app.module';
import { PlatformAuthModule } from './auth/platform.auth.module';
import { PlatformTokenAsyncApiService } from './auth/platform.token.async.service';
import { PlatformModuleModule } from './mod/mod.module';
import { PlatformKeycloakService } from './platform.keycloack.service';
import { PlatformController } from './platform.settings.controller';
import { PlatformSettingsService } from './platform.settings.service';
import { PlatformWellKnownController } from './platform.well-known.controller';
import { PlatformTopicsModule } from './topics/platform.topics.module';

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
    PlatformKeycloakService,
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
