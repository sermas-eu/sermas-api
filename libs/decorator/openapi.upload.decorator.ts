import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiOperationName } from './openapi.operation.decorator';

/** A multipart upload: the fields of `body` plus a binary `fileField`. */
export function ApiUpload(body?: Type, fileField = 'file') {
  const file = {
    type: 'object',
    properties: { [fileField]: { type: 'string', format: 'binary' } },
  };
  return applyDecorators(
    ApiOkResponse(),
    ApiOperationName(),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: body ? { allOf: [{ $ref: getSchemaPath(body) }, file] } : file,
    }),
    ...(body ? [ApiExtraModels(body)] : []),
  );
}
