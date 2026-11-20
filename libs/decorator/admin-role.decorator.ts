import { UseGuards, applyDecorators } from '@nestjs/common';
import { ROLE_ADMIN } from '#apps/keycloak/src/keycloak.service';
import { Roles } from '#libs/auth/auth.decorators';
import { JwtAuthGuard } from '#libs/auth/jwt.guard';
import { RoleGuard } from '#libs/auth/role.guard';

export function AdminRole() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RoleGuard),
    Roles(`realm:${ROLE_ADMIN}`),
  );
}
