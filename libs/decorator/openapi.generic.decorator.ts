import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptions,
  getSchemaPath,
} from '@nestjs/swagger';

export type ApiGenericPropertyOptions = ApiPropertyOptions & {
  genericModels?: Function[]; // eslint-disable-line
};

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
    } as ApiPropertyOptions),
  );
};

export function ApiGenericProperty(options?: ApiGenericPropertyOptions) {
  // eslint-disable-line
  options = options || {};
  options.required = true;
  return apiGenericObject(options);
}
export function ApiGenericPropertyOptional(
  options?: ApiGenericPropertyOptions,
) {
  // eslint-disable-line
  options = options || {};
  options.required = false;
  return apiGenericObject(options);
}
