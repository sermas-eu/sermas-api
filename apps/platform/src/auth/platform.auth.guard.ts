// based on https://github.com/ferrerojosh/nest-keycloak-connect/blob/master/src/guards/resource.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthJwtUser } from '#apps/auth/src/auth.dto';
import {
  META_PUBLIC,
  META_RESOURCE,
  META_SCOPES,
} from '#libs/auth/auth.constants';
import { PlatformContextDto } from './platform.auth.dto.js';
import { PlatformAuthService } from './platform.auth.service.js';

@Injectable()
export class PlatformGuard implements CanActivate {
  private readonly logger = new Logger(PlatformGuard.name);
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: PlatformAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<string>(
      META_RESOURCE,
      context.getClass(),
    );
    const scopes = this.reflector.get<string[]>(
      META_SCOPES,
      context.getHandler(),
    );
    const isUnprotected = this.reflector.getAllAndOverride<boolean>(
      META_PUBLIC,
      [context.getClass(), context.getHandler()],
    );

    // Extract request/response
    const [request] = extractRequest(context);

    // if is not an HTTP request ignore this guard
    if (!request) {
      return true;
    }

    const shouldAllow = false;

    // No resource given, check policy enforcement mode
    if (!resource) {
      if (shouldAllow) {
        this.logger.verbose(
          `Controller has no @Resource defined, request allowed due to policy enforcement`,
        );
      } else {
        this.logger.verbose(
          `Controller has no @Resource defined, request denied due to policy enforcement`,
        );
      }
      return shouldAllow;
    }

    // No scopes given, check policy enforcement mode
    if (!scopes) {
      if (shouldAllow) {
        this.logger.verbose(
          `Route ${request.path} has no @Scope defined, request allowed due to policy enforcement`,
        );
      } else {
        this.logger.verbose(
          `Route ${request.path} has no @Scope defined, request denied due to policy enforcement`,
        );
      }
      return shouldAllow;
    }

    this.logger.verbose(
      `Protecting resource [ ${resource} ] with scopes: [ ${scopes} ]`,
    );

    if (!request.user && isUnprotected) {
      this.logger.verbose(
        `Route ${request.path} has no user, and is public, allowed`,
      );
      return true;
    }

    let appId: string;
    if (request.body && request.body.appId) {
      appId = request.body.appId;
    }
    if (request.params && request.params.appId) {
      appId = request.params.appId;
    }

    if (!appId) {
      this.logger.verbose(`Failed to detect appId path=${request.path}`);
      // return false;
    }

    const user: AuthJwtUser = request.user;

    const appContext: PlatformContextDto = {
      clientId: user.azp,
      userId: user.sub,
      appId,
      resource,
      scopes,
      token: request.accessTokenJWT,
    };

    let isAllowed = false;
    try {
      isAllowed = await this.auth.isAllowed(appContext);
    } catch (e: any) {
      //
    }

    if (process.env.LOG_REQUEST === '1') {
      const ctx = { ...appContext };
      delete ctx.token;
      const logMsg = `isAllowed=${isAllowed} context=[${Object.entries(ctx)
        .map(([key, val]) => `${key}=${val}`)
        .join(' ')}}]`;

      // If statement for verbose logging only
      if (!isAllowed) {
        this.logger.warn(logMsg);
        this.logger.warn(
          `Resource [ ${resource} ] denied to [ ${appContext.clientId} ]`,
        );
      } else {
        this.logger.verbose(logMsg);
        this.logger.verbose(
          `Resource [ ${resource} ] granted to [ ${appContext.clientId} ]`,
        );
      }
    }

    return isAllowed;
  }
}

/** The HTTP request and response; both undefined for other transports. */
export const extractRequest = (context: ExecutionContext): [any, any] => {
  if (context.getType() !== 'http') return [undefined, undefined];
  const http = context.switchToHttp();
  return [http.getRequest(), http.getResponse()];
};
