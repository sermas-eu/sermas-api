import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './jwt.guard.js';
import { JwtVerifierService } from './jwt.verifier.service.js';
import { RoleGuard } from './role.guard.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [JwtVerifierService, JwtAuthGuard, RoleGuard],
  exports: [JwtVerifierService, JwtAuthGuard, RoleGuard],
})
export class AuthJwtModule {}
