import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { isNodeEnv, mapMqttTopic } from 'libs/util';
import {
  IClientPublishOptions,
  IClientSubscribeOptions,
  ISubscriptionGrant,
  MqttClient,
  Packet,
} from 'mqtt';
import { MQTT_CLIENT_INSTANCE } from './mqtt.constants';

@Injectable()
export class MqttService {
  private readonly logger = new Logger(MqttService.name);
  constructor(
    private readonly emitter: EventEmitter2,
    @Inject(MQTT_CLIENT_INSTANCE) private readonly client: MqttClient,
  ) {}

  subscribe(
    topic: string | string[],
    opts?: IClientSubscribeOptions,
  ): Promise<ISubscriptionGrant[]> {
    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, opts || null, (err, granted) => {
        if (err) {
          reject(err);
        } else {
          resolve(granted);
        }
      });
    });
  }

  unsubscribe(topic: string, opts?: IClientSubscribeOptions): Promise<Packet> {
    return new Promise<Packet>((resolve, reject) => {
      this.client.unsubscribe(topic, opts, (error, packet) => {
        if (error) {
          reject(error);
        } else {
          resolve(packet);
        }
      });
    });
  }

  publish(
    topic: string,
    message: string | Buffer | object,
    opts?: IClientPublishOptions,
  ): Promise<Packet> {
    return new Promise<Packet>((resolve, reject) => {
      let payload: string | Buffer;

      let isBuffer = false;
      const buffer = message as Buffer;
      if (buffer.readUint8 !== undefined) {
        isBuffer = true;
        payload = buffer;
      }

      let isObject = false;
      if (!isBuffer && typeof message === 'object') {
        isObject = true;
        payload = JSON.stringify(message);
      }

      // @SERMAS
      let rawTopic: string = null;
      if (isObject && (message as any).appId && topic.indexOf(':') > -1) {
        rawTopic = topic;
        const args: any = { ...(message as any) };
        if (args.record) {
          const scope = rawTopic.split('/')[3] || null;

          const obj = args.record as any;
          const fieldName = `${scope}Id`;
          if (
            obj &&
            obj[fieldName] !== undefined &&
            typeof obj[fieldName] === 'string'
          ) {
            args[fieldName] = obj[fieldName];
          }
          if (args.record.sessionId) args.sessionId = args.record.sessionId;
          if (args.record.agentId) args.agentId = args.record.agentId;
        }

        topic = mapMqttTopic(topic, args);

        if (topic.indexOf(':') > -1) {
          this.logger.warn(
            `Topic may have not been properly transformed ? ${topic}`,
          );
        }
      }
      // / @SERMAS

      this.client.publish(topic, payload, opts || null, (error, packet) => {
        if (error) {
          if (isNodeEnv('test') && this.client.disconnecting)
            return resolve(null);
          // return reject(error);
          this.logger.error(`Failed to publish to ${topic}: ${error.stack}`);
          return resolve(null);
        }

        if (rawTopic) this.emitter.emit(`mqtt.pub.${rawTopic}`, message);

        resolve(packet);
      });
    });
  }
}
