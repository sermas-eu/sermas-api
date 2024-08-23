import { UseGuards, applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptions,
  getSchemaPath,
} from '@nestjs/swagger';
import { PlatformGuard } from 'apps/platform/src/auth/platform.auth.guard';
import { AuthGuard, Resource, Scopes } from 'nest-keycloak-connect';

export function ApiResource(params: string) {
  const decorators = [
    UseGuards(
      AuthGuard,
      PlatformGuard,
      // ResourceGuard
    ),
    Resource(params),
  ];
  return applyDecorators(...decorators);
}

export function ApiScopes(params: string | string[]) {
  if (typeof params === 'string') {
    params = [params];
  }

  const decorators: MethodDecorator[] = [Scopes(...params)];
  return applyDecorators(...decorators);
}

export interface ApiGenericPropertyOptions extends ApiPropertyOptions {
  genericModels?: Function[]; // eslint-disable-line
}

const apiGenericObject = (options?: ApiGenericPropertyOptions) => {
  const models = options?.genericModels || [];

  const apiOptions = { ...(options || {}) };
  if (apiOptions.genericModels) delete apiOptions.genericModels;

  return applyDecorators(
    ...[...(models && models.length ? [ApiExtraModels(...models)] : [])],
    ApiProperty({
      ...(apiOptions || {}),
      type: 'object',
      allOf: [
        ...(models && models.length
          ? models.map((m) => ({ $ref: getSchemaPath(m) }))
          : []),
        {
          type: 'object',
        },
      ],
    }),
  );
};

export function ApiGenericProperty(options?: ApiGenericPropertyOptions) {  // eslint-disable-line
  options = options || {};
  options.required = true;
  return apiGenericObject(options);
}
export function ApiGenericPropertyOptional(options?: ApiGenericPropertyOptions) {  // eslint-disable-line
  options = options || {};
  options.required = false;
  return apiGenericObject(options);
}
