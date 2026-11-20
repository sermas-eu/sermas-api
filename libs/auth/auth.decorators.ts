import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import {
  META_PUBLIC,
  META_RESOURCE,
  META_ROLES,
  META_SCOPES,
} from './auth.constants';

/** The route accepts requests without a token. A valid token still sets the user. */
export const Public = () => SetMetadata(META_PUBLIC, true);

/** The Keycloak authorization resource a controller maps to. */
export const Resource = (resource: string) =>
  SetMetadata(META_RESOURCE, resource);

/** The scopes of the controller's resource a route requires. */
export const Scopes = (...scopes: string[]) => SetMetadata(META_SCOPES, scopes);

/** Realm roles a route requires, all of them, as `realm:<role>` or `<role>`. */
export const Roles = (...roles: string[]) => SetMetadata(META_ROLES, roles);

/** The verified token payload, or undefined on a public route called without one. */
export const AuthenticatedUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest()?.user,
);
