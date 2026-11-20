import { Module } from '@nestjs/common';
import { KeycloakModule } from '#apps/keycloak/src/keycloak.module';
import { PlatformAuthEventsService } from './platform.auth.events.service.js';
import { PlatformAuthService } from './platform.auth.service.js';
import { PlatformTokenAsyncApiService } from './platform.token.async.service.js';
import { PlatformAuthTokenController } from './platform.token.controller.js';
import { PlatformAuthTokenService } from './platform.token.service.js';

@Module({
  imports: [KeycloakModule],
  controllers: [PlatformAuthTokenController],
  providers: [
    PlatformAuthTokenService,
    PlatformTokenAsyncApiService,
    PlatformAuthService,
    PlatformAuthEventsService,
  ],
  exports: [PlatformAuthTokenService, PlatformAuthService],
})
export class PlatformAuthModule {}
