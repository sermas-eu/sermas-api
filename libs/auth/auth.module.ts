import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './jwt.guard';
import { JwtVerifierService } from './jwt.verifier.service';
import { RoleGuard } from './role.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [JwtVerifierService, JwtAuthGuard, RoleGuard],
  exports: [JwtVerifierService, JwtAuthGuard, RoleGuard],
})
export class AuthJwtModule {}
