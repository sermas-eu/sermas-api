import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeycloakModule } from '#apps/keycloak/src/keycloak.module';
import { LocalOidcController } from './oidc/local-oidc.controller.js';
import { AuthAdminController } from './auth.admin.controller.js';
import { AuthAsyncApiService } from './auth.async.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MqttController } from './mqtt/mqtt.controller.js';
import { MqttService } from './mqtt/mqtt.service.js';

@Module({
  imports: [ConfigModule, KeycloakModule],
  controllers: [
    AuthController,
    MqttController,
    AuthAdminController,
    LocalOidcController,
  ],
  providers: [AuthService, MqttService, AuthAsyncApiService],
  exports: [],
})
export class AuthModule {}
