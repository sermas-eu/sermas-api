import { capitalize } from 'libs/util';
import { AsyncApiPub, AsyncApiSub, AsyncTagObject } from 'nestjs-asyncapi';
import { AsyncApiMessage } from 'nestjs-asyncapi/dist/lib/interface/asyncapi-message.interface';

export function AsyncApiOperationName(options: {
  publish?: boolean;
  subscribe?: boolean;
  channel: string;
  message: AsyncApiMessage;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: AsyncTagObject[];
}) {
  return function (target: any, key: any, descriptor: PropertyDescriptor) {
    const [, , resource] = options.channel.split('/');

    const operationId = options.operationId || key;

    const metadata = {
      operationId,
      description: options.description || options.summary,
      channel: options.channel,
      message: options.message,
      tags: options.tags || [
        {
          name: resource,
        },
      ],
    };

    if (options.subscribe === undefined || options.subscribe === true)
      AsyncApiSub({
        ...metadata,
        description:
          metadata.description && metadata.description.startsWith('Publish')
            ? metadata.description.replace('Publish ', 'Subscribe to ')
            : metadata.description,
        operationId: `on${capitalize(operationId)}`,
      })(target, key, descriptor as any);

    if (options.publish === undefined || options.publish === true)
      AsyncApiPub(metadata)(target, key, descriptor as any);

    return descriptor;
  };
}
