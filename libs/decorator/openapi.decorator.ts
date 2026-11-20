import { UseGuards, applyDecorators } from '@nestjs/common';
import { PlatformGuard } from 'apps/platform/src/auth/platform.auth.guard';
import { Resource, Scopes } from 'libs/auth/auth.decorators';
import { JwtAuthGuard } from 'libs/auth/jwt.guard';

export function ApiResource(params: string) {
  const decorators = [UseGuards(JwtAuthGuard, PlatformGuard), Resource(params)];
  return applyDecorators(...decorators);
}

export function ApiScopes(params: string | string[]) {
  if (typeof params === 'string') {
    params = [params];
  }

  const decorators: MethodDecorator[] = [Scopes(...params)];
  return applyDecorators(...decorators);
}
