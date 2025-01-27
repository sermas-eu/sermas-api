import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KeycloakModule } from 'apps/keycloak/src/keycloak.module';
import { MqttModule } from 'libs/mqtt-handler/mqtt.module';
import {
  KEYCLOAK_CONNECT_OPTIONS,
  KEYCLOAK_LOGGER,
  KeycloakConnectModule,
  KeycloakConnectOptions,
  PolicyEnforcementMode,
  TokenValidation,
} from 'nest-keycloak-connect';
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
    KeycloakConnectModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): KeycloakConnectOptions => {
        return {
          authServerUrl: config.get('AUTH_KEYCLOAK_URL'),
          realm: config.get('AUTH_KEYCLOAK_REALM'),
          clientId: config.get('AUTH_KEYCLOAK_CLIENT_ID'),
          secret: config.get('AUTH_KEYCLOAK_SECRET'),
          cookieKey: 'KEYCLOAK_JWT',
          useNestLogger: true,
          policyEnforcement: PolicyEnforcementMode.ENFORCING,
          tokenValidation: TokenValidation.OFFLINE,
        };
      },
    }),
    PlatformAuthModule,
    PlatformAppModule,
    PlatformModuleModule,
  ],
  controllers: [PlatformController, PlatformWellKnownController],
  providers: [
    {
      provide: KEYCLOAK_LOGGER,
      // useFactory: (opts: KeycloakConnectOptions) => {
      useFactory: () => {
        const logger = new Logger('KeycloakConnect');
        // logger.localInstance.setLogLevels(['error', 'warn', 'log', 'debug']);
        if (process.env.SHOW_KEYCLOAK_LOGS !== '1') {
          // const verboseLog = logger.verbose;
          // logger.verbose = (...args) => {
          logger.verbose = () => {
            // if (args[0].indexOf('Authenticated User') === -1) return;
            // verboseLog.apply(logger, args);
          };
        }
        return logger;
      },
      inject: [KEYCLOAK_CONNECT_OPTIONS],
    },
    PlatformKeycloakService,
    PlatformSettingsService,
    PlatformAppClientService,
    PlatformTokenAsyncApiService,
  ],
  exports: [
    KEYCLOAK_LOGGER,
    PlatformAuthModule,
    PlatformAppModule,

    KeycloakModule,
    KeycloakConnectModule,

    PlatformKeycloakService,
  ],
})
export class PlatformModule {}
