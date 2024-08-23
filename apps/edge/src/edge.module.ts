import { Module } from '@nestjs/common';
import { EdgeController } from './edge.controller';
import { EdgeService } from './edge.service';
import { StreamViewerModule } from 'apps/detection/src/detection.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MqttModule } from 'libs/mqtt-handler/mqtt.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.production', '.env.staging', '.env'],
    }),
    MqttModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('MQTT_URL'),
        password: configService.get<string>('MQTT_PASSWORD'),
        keycloakUrl: configService.get<string>('AUTH_KEYCLOAK_URL'),
        keycloakRealm: configService.get<string>('AUTH_KEYCLOAK_REALM'),
        keycloakServiceAccountClientId: configService.get<string>(
          'MQTT_KEYCLOAK_SERVICE_ACCOUNT_CLIENT_ID',
        ),
        keycloakClientSecret: configService.get<string>(
          'MQTT_KEYCLOAK_SERVICE_ACCOUNT_CLIENT_SECRET',
        ),
        keycloakServiceAccountUsername: configService.get<string>(
          'MQTT_KEYCLOCK_SERVICE_ACCOUNT_USERNAME',
        ),
        keycloakServiceAccountPassword: configService.get<string>(
          'MQTT_KEYCLOCK_SERVICE_ACCOUNT_PASSWORD',
        ),
      }),
    }),
    EventEmitterModule.forRoot(),
    StreamViewerModule,
  ],
  controllers: [EdgeController],
  providers: [EdgeService],
})
export class EdgeModule {}
