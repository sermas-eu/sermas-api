import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { META_PUBLIC, TOKEN_COOKIE } from './auth.constants';
import { JwtVerifierService } from './jwt.verifier.service';

export const extractToken = (request: any): string | undefined => {
  const header: string | undefined = request.headers?.authorization;
  if (header) {
    const [type, value] = header.split(' ');
    if (type?.toLowerCase() === 'bearer' && value) return value.trim();
  }
  const cookies: string | undefined = request.headers?.cookie;
  if (cookies) {
    for (const part of cookies.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === TOKEN_COOKIE && rest.length) return rest.join('=');
    }
  }
  return undefined;
};

/**
 * Authenticates HTTP requests with a Keycloak access token. On success the payload
 * is `request.user` and the raw token `request.accessTokenJWT`.
 *
 * A route marked @Public() is never rejected here; a valid token on it still sets
 * the user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(META_PUBLIC, [
      context.getClass(),
      context.getHandler(),
    ]);

    const token = extractToken(request);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException();
    }

    try {
      request.user = await this.verifier.verify(token);
      request.accessTokenJWT = token;
      return true;
    } catch (e: any) {
      this.logger.warn(`Cannot validate access token: ${e.message}`);
      if (isPublic) return true;
      throw new UnauthorizedException();
    }
  }
}
