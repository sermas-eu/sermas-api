import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiBodyOptions,
  ApiExtraModels,
  ApiOkResponse,
} from '@nestjs/swagger';
import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ApiOperationName } from './openapi.operation.decorator';

import { ModelPropertiesAccessor } from '@nestjs/swagger/dist/services/model-properties-accessor';
import { SchemaObjectFactory } from '@nestjs/swagger/dist/services/schema-object-factory';
import { SwaggerTypesMapper } from '@nestjs/swagger/dist/services/swagger-types-mapper';

function getJsonSchema(targetConstructor: Type<unknown>) {
  const factory = new SchemaObjectFactory(
    new ModelPropertiesAccessor(),
    new SwaggerTypesMapper(),
  );

  const schemas: Record<string, SchemaObject> = {};
  factory.exploreModelSchema(targetConstructor, schemas);

  return schemas[targetConstructor.name];
}

const createBodySchema = (body?: Type, fileField = 'file'): ApiBodyOptions => {
  const objSchema: SchemaObject = body ? getJsonSchema(body) : undefined;
  return {
    schema: {
      type: 'object',
      properties: {
        ...(objSchema?.properties ? objSchema?.properties : {}),
        [fileField]: {
          type: 'file',
        },
      },
    },
  };
};

export function ApiUpload(body?: Type, fileField?: string) {
  const extraModels = body ? [body] : [];
  return applyDecorators(
    ApiOkResponse(),
    ApiOperationName(),
    ApiBody(createBodySchema(body, fileField)),
    ApiExtraModels(...extraModels),
  );
}
