import { UseGuards, applyDecorators } from '@nestjs/common';
import { ROLE_ADMIN } from 'apps/keycloak/src/keycloak.service';
import {
  AuthGuard,
  RoleGuard,
  RoleMatchingMode,
  Roles,
} from 'nest-keycloak-connect';

export function AdminRole() {
  return applyDecorators(
    UseGuards(AuthGuard, RoleGuard),
    Roles({ roles: [`realm:${ROLE_ADMIN}`], mode: RoleMatchingMode.ALL }),
  );
}
