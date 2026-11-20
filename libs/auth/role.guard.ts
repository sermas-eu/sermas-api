import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { META_ROLES } from './auth.constants';

/**
 * Requires every realm role named by @Roles(). Runs after JwtAuthGuard, which sets
 * `request.user`. Roles may be written `realm:<role>` or `<role>`.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(META_ROLES, [
      context.getClass(),
      context.getHandler(),
    ]);
    if (!roles || !roles.length) return true;

    const user = context.switchToHttp().getRequest()?.user;
    const granted: string[] = user?.realm_access?.roles || [];
    const ok = roles
      .map((r) => r.replace(/^realm:/, ''))
      .every((r) => granted.includes(r));
    if (!ok) throw new ForbiddenException();
    return true;
  }
}
