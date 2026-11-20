import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import {
  AsyncApi,
  AsyncApiOperationName,
  createAsyncApiDocument,
  getAsyncApiOperations,
} from 'libs/asyncapi';

class NestedDto {
  @ApiProperty()
  value: number;
}

class EventDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ type: NestedDto })
  nested: NestedDto;
}

@AsyncApi()
@Injectable()
class EventsAsyncApiService {
  @AsyncApiOperationName({
    channel: 'app/:appId/things/changed',
    message: { payload: EventDto },
    description: 'Publish a thing change',
  })
  changed() {}

  @AsyncApiOperationName({
    channel: 'app/:appId/things/command',
    message: { payload: EventDto },
    subscribe: false,
  })
  command() {}
}

@AsyncApi()
@Injectable()
class NotRegisteredAsyncApiService {
  @AsyncApiOperationName({
    channel: 'app/:appId/other/event',
    message: { payload: EventDto },
  })
  event() {}
}

describe('AsyncAPI', () => {
  it('records a subscribe and a publish operation per method', () => {
    const ops = getAsyncApiOperations(EventsAsyncApiService);
    expect(ops.map((o) => `${o.type}:${o.operationId}`)).toEqual([
      'subscribe:onChanged',
      'publish:changed',
      'publish:command',
    ]);
    const sub = ops[0];
    expect(sub.description).toBe('Subscribe to a thing change');
    expect(sub.tags).toEqual([{ name: 'things' }]);
    expect(sub.messageName).toBe('EventsAsyncApiService#changed');
  });

  it('documents only registered providers, with payload schemas', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [EventsAsyncApiService],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const doc = createAsyncApiDocument(app, { title: 't', version: '1' });

    expect(doc.asyncapi).toBe('2.5.0');
    expect(Object.keys(doc.channels)).toEqual([
      'app/:appId/things/changed',
      'app/:appId/things/command',
    ]);
    const changed = doc.channels['app/:appId/things/changed'];
    expect(changed.publish.message.payload).toEqual({
      $ref: '#/components/schemas/EventDto',
    });
    expect(changed.subscribe.operationId).toBe('onChanged');
    expect(doc.channels['app/:appId/things/command'].subscribe).toBeUndefined();
    expect(Object.keys(doc.components.schemas).sort()).toEqual([
      'EventDto',
      'NestedDto',
    ]);
    expect(NotRegisteredAsyncApiService).toBeDefined();

    await app.close();
  });
});
