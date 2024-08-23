import { Module } from '@nestjs/common';
import { KeycloakModule } from 'apps/keycloak/src/keycloak.module';
import { PlatformAuthEventsService } from './platform.auth.events.service';
import { PlatformAuthService } from './platform.auth.service';
import { PlatformTokenAsyncApiService } from './platform.token.async.service';
import { PlatformAuthTokenController } from './platform.token.controller';
import { PlatformAuthTokenService } from './platform.token.service';

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
