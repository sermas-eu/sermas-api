import { INestApplicationContext, Module } from '@nestjs/common';
import { SwaggerModule, getSchemaPath } from '@nestjs/swagger';
import {
  AsyncApiPayloadType,
  getAsyncApiOperations,
  getAsyncApiServices,
} from './asyncapi.decorators.js';
import { AsyncApiDocument } from './asyncapi.types.js';

// Passed as swagger's only included module so that no route is scanned:
// the swagger document is used just to render the payload schemas.
@Module({})
class AsyncApiSchemasOnly {}

export interface AsyncApiDocumentOptions {
  title: string;
  description?: string;
  version: string;
  servers?: AsyncApiDocument['servers'];
}

const isRegistered = (app: INestApplicationContext, type: any) => {
  try {
    app.get(type, { strict: false });
    return true;
  } catch {
    return false;
  }
};

/**
 * Builds an AsyncAPI 2.5 document from the AsyncApi() providers registered
 * in the application. Payload schemas come from the swagger decorators.
 */
export const createAsyncApiDocument = (
  app: INestApplicationContext,
  options: AsyncApiDocumentOptions,
): AsyncApiDocument => {
  const document: AsyncApiDocument = {
    asyncapi: '2.5.0',
    info: {
      title: options.title,
      description: options.description,
      version: options.version,
      contact: {},
    },
    tags: [],
    servers: options.servers || {},
    components: {
      securitySchemes: {
        bearer: { scheme: 'bearer', bearerFormat: 'JWT', type: 'http' },
      },
      schemas: {},
    },
    defaultContentType: 'application/json',
    channels: {},
  };

  const payloads = new Set<AsyncApiPayloadType>();

  for (const service of getAsyncApiServices()) {
    if (!isRegistered(app, service)) continue;
    for (const op of getAsyncApiOperations(service)) {
      payloads.add(op.payload);
      const channel = (document.channels[op.channel] =
        document.channels[op.channel] || {});
      // the first documented operation for a channel wins
      if (channel[op.type]) continue;
      channel[op.type] = {
        operationId: op.operationId,
        description: op.description,
        message: {
          payload: { $ref: getSchemaPath(op.payload as any) },
          name: op.messageName,
        },
        tags: op.tags,
      };
    }
  }

  const schemas = SwaggerModule.createDocument(
    app as any,
    { openapi: '3.0.0', info: { title: '', version: '' } },
    { include: [AsyncApiSchemasOnly], extraModels: [...payloads] },
  ).components?.schemas;

  document.components.schemas = { ...(schemas || {}) } as any;
  return document;
};
