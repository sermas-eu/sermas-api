import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import {
  META_CREATES_APP,
  META_PUBLIC,
  META_RESOURCE,
  META_ROLES,
  META_SCOPES,
} from './auth.constants.js';

/** The route accepts requests without a token. A valid token still sets the user. */
export const Public = () => SetMetadata(META_PUBLIC, true);

/**
 * The route creates the app its body names: the guard does not require access
 * to that appId (no one has it yet); the route refuses one that exists.
 */
export const CreatesApp = () => SetMetadata(META_CREATES_APP, true);

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
