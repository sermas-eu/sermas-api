// based on https://github.com/ferrerojosh/nest-keycloak-connect/blob/master/src/guards/resource.guard.ts
import {
  CanActivate,
  ContextType,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import {
  META_RESOURCE,
  META_SCOPES,
  META_UNPROTECTED,
} from 'nest-keycloak-connect';
import { PlatformContextDto } from './platform.auth.dto';
import { PlatformAuthService } from './platform.auth.service';

type GqlContextType = 'graphql' | ContextType;

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
      META_UNPROTECTED,
      [context.getClass(), context.getHandler()],
    );

    // Extract request/response
    const [request, response] = extractRequest(context);

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

export const extractRequest = (context: ExecutionContext): [any, any] => {
  let request: any, response: any;

  // Check if request is coming from graphql or http
  if (context.getType() === 'http') {
    // http request
    const httpContext = context.switchToHttp();

    request = httpContext.getRequest();
    response = httpContext.getResponse();
  } else if (context.getType<GqlContextType>() === 'graphql') {
    let gql: any;
    // Check if graphql is installed
    try {
      gql = require('@nestjs/graphql');
    } catch (er) {
      throw new Error('@nestjs/graphql is not installed, cannot proceed');
    }

    // graphql request
    const gqlContext = gql.GqlExecutionContext.create(context).getContext();

    request = gqlContext.req;
    response = gqlContext.res;
  }

  return [request, response];
};
