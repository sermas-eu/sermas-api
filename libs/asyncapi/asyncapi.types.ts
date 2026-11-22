// The subset of AsyncAPI 2.x this API emits and reads from platform modules.
// Spec: https://www.asyncapi.com/docs/reference/specification/v2.6.0

export type AsyncApiSchemaObject = Record<string, any>;

export interface AsyncApiTag {
  name: string;
  description?: string;
}

export interface AsyncApiMessageObject {
  name?: string;
  payload?: AsyncApiSchemaObject;
  [key: string]: any;
}

export interface AsyncApiOperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: AsyncApiTag[];
  message?: AsyncApiMessageObject;
  [key: string]: any;
}

export interface AsyncApiChannelObject {
  description?: string;
  publish?: AsyncApiOperationObject;
  subscribe?: AsyncApiOperationObject;
  [key: string]: any;
}

export type AsyncApiOperationType = 'publish' | 'subscribe';

export interface AsyncApiDocument {
  asyncapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: Record<string, string>;
  };
  defaultContentType?: string;
  servers?: Record<string, { url: string; protocol: string }>;
  tags?: AsyncApiTag[];
  channels: Record<string, AsyncApiChannelObject>;
  components?: {
    schemas?: Record<string, AsyncApiSchemaObject>;
    securitySchemes?: Record<string, AsyncApiSchemaObject>;
  };
}
