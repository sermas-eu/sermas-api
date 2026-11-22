import { EventEmitter2 } from '@nestjs/event-emitter';
import type { MqttClient } from 'mqtt';
import { MqttService } from './mqtt.service.js';

const service = () => {
  const client = {
    publish: vi.fn((_t, _p, _o, cb) => cb(undefined, { cmd: 'publish' })),
  };
  return {
    client,
    mqtt: new MqttService(new EventEmitter2(), client as unknown as MqttClient),
  };
};

describe('MqttService.publish', () => {
  it('maps topic variables from the payload', async () => {
    const { client, mqtt } = service();
    await mqtt.publish('app/:appId/platform/client/changed/:clientId', {
      appId: 'a1',
      clientId: 'avatar',
    });
    expect(client.publish.mock.calls[0][0]).toBe(
      'app/a1/platform/client/changed/avatar',
    );
  });

  // D-39: a throw here was an unhandled rejection for fire-and-forget callers,
  // which ends the process
  it('resolves null, without publishing, when a topic variable is missing', async () => {
    const { client, mqtt } = service();
    await expect(
      mqtt.publish('app/:appId/platform/client/changed/:clientId', {
        appId: 'a1',
        clientId: undefined,
      }),
    ).resolves.toBeNull();
    expect(client.publish).not.toHaveBeenCalled();
  });
});
