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

    // Public means anyone: a valid token must not get less than no token.
    // Routes that act on the caller's identity check it themselves.
    if (isUnprotected) {
      this.logger.verbose(`Route ${request.path} is public, allowed`);
      return true;
    }

    // every appId the request names: path, query, body (or each body item)
    const appIds = collectAppIds(request);
    if (appIds.length > 1) {
      this.logger.warn(
        `Conflicting appId in request path=${request.path}: ${appIds.join(',')}`,
      );
      return false;
    }
    let [appId] = appIds;

    // a session named by the request must belong to that app; when the request
    // names no app, the session's app is the one checked
    for (const sessionId of collectSessionIds(request)) {
      const sessionAppId = await this.auth.getSessionAppId(sessionId);
      if (!sessionAppId) continue;
      if (appId && sessionAppId !== appId) {
        this.logger.warn(
          `Session ${sessionId} is not in app ${appId} path=${request.path}`,
        );
        return false;
      }
      appId = sessionAppId;
    }

    if (!appId) {
      this.logger.verbose(`Failed to detect appId path=${request.path}`);
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

    let isAllowed: boolean;
    try {
      // the scope: an app's own clients (kiosk, modules) may read that app's
      // resources; anything else goes through the Keycloak permissions
      isAllowed =
        (request.method === 'GET' &&
          (await this.auth.isOwnAppClient(appId, user.azp))) ||
        (await this.auth.isAllowed(appContext));
      // app isolation: the scope says what, this says on which app. Routes
      // that name no app check the record they load themselves.
      if (isAllowed && appId)
        isAllowed = await this.auth.canAccessApp(user, appId);
    } catch {
      isAllowed = false;
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

const appIdOf = (v: unknown): string | undefined =>
  v && typeof v === 'object' && typeof (v as any).appId === 'string'
    ? (v as any).appId
    : undefined;

/** The distinct appIds a request names, in its path, query and body. */
export const collectAppIds = (request: any): string[] => {
  const ids = [
    request.params?.appId,
    typeof request.query?.appId === 'string' ? request.query.appId : undefined,
    ...(Array.isArray(request.body)
      ? request.body.map(appIdOf)
      : [appIdOf(request.body)]),
  ].filter((id): id is string => typeof id === 'string' && id !== '');
  return [...new Set(ids)];
};

/** The distinct sessionIds a request names, in its path, query and body. */
export const collectSessionIds = (request: any): string[] => {
  const of = (v: any) =>
    v && typeof v === 'object' && typeof v.sessionId === 'string'
      ? v.sessionId
      : undefined;
  const ids = [
    request.params?.sessionId,
    typeof request.query?.sessionId === 'string'
      ? request.query.sessionId
      : undefined,
    ...(Array.isArray(request.body)
      ? request.body.map(of)
      : [of(request.body)]),
  ].filter((id): id is string => typeof id === 'string' && id !== '');
  return [...new Set(ids)];
};
