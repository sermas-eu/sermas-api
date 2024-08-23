import { ApiOperation } from '@nestjs/swagger';

export function ApiOperationName(options?: {
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
}) {
  options = options || {};
  return function (target: any, key: any, descriptor: PropertyDescriptor) {
    ApiOperation({
      operationId: options.operationId || key,
      summary: options.summary || options.description,
      deprecated: options.deprecated || false,
    })(target, key, descriptor as any);
    return descriptor;
  };
}
