import 'reflect-metadata';
import { capitalize } from '#libs/util';
import { AsyncApiTag } from './asyncapi.types.js';

/** A payload class: a DTO decorated for swagger, or Buffer for binary frames. */
export type AsyncApiPayloadType = abstract new (...args: any[]) => unknown;

export interface AsyncApiOperationOptions {
  /** Document a publish operation (default true). */
  publish?: boolean;
  /** Document a subscribe operation (default true). */
  subscribe?: boolean;
  channel: string;
  message: { payload: AsyncApiPayloadType; name?: string };
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: AsyncApiTag[];
}

export interface AsyncApiOperationMetadata {
  type: 'publish' | 'subscribe';
  channel: string;
  operationId: string;
  description?: string;
  messageName: string;
  payload: AsyncApiPayloadType;
  tags: AsyncApiTag[];
}

const ASYNCAPI_SERVICE = 'sermas:asyncapi:service';
const ASYNCAPI_OPERATIONS = 'sermas:asyncapi:operations';

/** Classes decorated with AsyncApi(), in definition order. */
const registry = new Set<AsyncApiPayloadType>();

export const getAsyncApiServices = (): AsyncApiPayloadType[] => [...registry];

export const getAsyncApiOperations = (
  target: AsyncApiPayloadType,
): AsyncApiOperationMetadata[] =>
  Reflect.getMetadata(ASYNCAPI_OPERATIONS, target) || [];

/** Marks a provider whose methods document MQTT operations. */
export function AsyncApi(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(ASYNCAPI_SERVICE, true, target);
    registry.add(target as unknown as AsyncApiPayloadType);
  };
}

/**
 * Documents a method as a publish and/or subscribe operation on an MQTT
 * channel. The subscribe side gets the operation id `on<OperationId>`.
 */
export function AsyncApiOperationName(
  options: AsyncApiOperationOptions,
): MethodDecorator {
  return (target, key) => {
    const ctor = target.constructor as AsyncApiPayloadType;
    const [, , resource] = options.channel.split('/');
    const operationId = options.operationId || String(key);
    const description = options.description || options.summary;
    const messageName = options.message.name || `${ctor.name}#${String(key)}`;
    const tags = options.tags || [{ name: resource }];

    const operations = [...getAsyncApiOperations(ctor)];

    if (options.subscribe !== false)
      operations.push({
        type: 'subscribe',
        channel: options.channel,
        operationId: `on${capitalize(operationId)}`,
        description:
          description && description.startsWith('Publish')
            ? description.replace('Publish ', 'Subscribe to ')
            : description,
        messageName,
        payload: options.message.payload,
        tags,
      });

    if (options.publish !== false)
      operations.push({
        type: 'publish',
        channel: options.channel,
        operationId,
        description,
        messageName,
        payload: options.message.payload,
        tags,
      });

    Reflect.defineMetadata(ASYNCAPI_OPERATIONS, operations, ctor);
  };
}
