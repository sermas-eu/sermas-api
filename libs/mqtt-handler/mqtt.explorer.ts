import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PlatformTopicsService } from 'apps/platform/src/topics/platform.topics.service';
import { SermasBaseDto } from 'libs/sermas/sermas.dto';
import {
  addDTOContext,
  extractTopicAppId,
  isNodeEnv,
  mapMqttTopic,
} from 'libs/util';
import { MqttClient } from 'mqtt';
import { Packet } from 'mqtt-packet';
import {
  MQTT_CLIENT_INSTANCE,
  MQTT_LOGGER_PROVIDER,
  MQTT_OPTION_PROVIDER,
  MQTT_SUBSCRIBER_PARAMS,
  MQTT_SUBSCRIBE_OPTIONS,
} from './mqtt.constants';
import {
  MqttModuleOptions,
  MqttSubscribeOptions,
  MqttSubscriber,
  MqttSubscriberParameter,
} from './mqtt.interface';
import { getTransform } from './mqtt.transform';

@Injectable()
export class MqttExplorer implements OnModuleInit, OnModuleDestroy {
  private readonly reflector = new Reflector();
  subscribers: MqttSubscriber[];
  subscriptionTopics: string[];

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly emitter: EventEmitter2,
    @Inject(MQTT_LOGGER_PROVIDER) private readonly logger: Logger,
    @Inject(MQTT_CLIENT_INSTANCE) private readonly client: MqttClient,
    @Inject(MQTT_OPTION_PROVIDER) private readonly options: MqttModuleOptions,
    private readonly platformTopics: PlatformTopicsService,
  ) {
    this.subscribers = [];
    this.subscriptionTopics = [];
  }

  onModuleInit() {
    this.logger.log('MqttModule dependencies initialized');
    this.explore();
  }

  onModuleDestroy() {
    this.client.removeAllListeners('message');
    if (isNodeEnv('test')) {
      this.client.removeAllListeners('error');
      this.client.on('error', () => {
        // silence errors on shutdown
      });
    }
    this.subscribers = [];
    try {
      this.client.unsubscribe(this.subscriptionTopics);
    } catch (e: any) {
      this.logger.verbose(`Unsubscribe error: ${e.message}`);
    }
    this.logger.log('MqttModule dependencies deinitialized');
  }

  preprocess(options: MqttSubscribeOptions): string | string[] {
    const processTopic = (topic) => {
      const queue =
        typeof options.queue === 'boolean' ? options.queue : this.options.queue;
      const share =
        typeof options.share === 'string' ? options.share : this.options.share;
      topic = topic
        .replace('$queue/', '')
        .replace(/^\$share\/([A-Za-z0-9]+)\//, '');
      if (queue) {
        return `$queue/${topic}`;
      }

      if (share) {
        return `$share/${share}/${topic}`;
      }

      return topic;
    };
    if (Array.isArray(options.topic)) {
      return options.topic.map(processTopic);
    } else {
      // this.logger.log(options.topic);
      return processTopic(options.topic);
    }
  }

  subscribe(
    options: MqttSubscribeOptions,
    parameters: MqttSubscriberParameter[],
    handle,
    provider,
  ) {
    //@SERMAS
    let topics =
      options.topic instanceof Array ? options.topic : [options.topic];
    options.rawTopics = [...topics];

    // default is to convert `:placeholder` to `+` wildcard
    const mapArgs = (topic: string, args: Record<string, any> = {}) => ({
      ...topic
        .split('/')
        .filter((key) => key[0] === ':')
        .map((key) => key.substring(1))
        .reduce((o, key) => ({ ...o, [key]: '+' }), {}),
      ...(args || {}),
    });

    topics = topics.map((topic: string) =>
      mapMqttTopic(topic, mapArgs(topic, options.args)),
    );
    options.topic = topics;

    topics.forEach((topic) => this.logger.verbose(`SUB ${topic}`));

    // / @SERMAS

    const subscriptionTopics = this.preprocess(options);

    this.subscriptionTopics = Array.from([
      ...new Set([...subscriptionTopics, ...subscriptionTopics]),
    ]);

    this.client.subscribe(subscriptionTopics, (err) => {
      if (!err) {
        // put it into this.subscribers;
        this.addSubscriber(options, parameters, handle, provider);
      } else if (err.message === 'Connection closed') {
        //May be we are in app startup
        setTimeout(
          () => this.addSubscriber(options, parameters, handle, provider),
          5000,
        );
      } else {
        this.logger.error(`subscribe topic [${options.topic} failed]`);
      }
    });
  }

  explore() {
    const providers: InstanceWrapper[] = this.discoveryService.getProviders();
    providers.forEach((wrapper: InstanceWrapper) => {
      const { instance } = wrapper;
      if (!instance) {
        return;
      }
      this.metadataScanner.scanFromPrototype(
        instance,
        Object.getPrototypeOf(instance),
        (key) => {
          const subscribeOptions: MqttSubscribeOptions = this.reflector.get(
            MQTT_SUBSCRIBE_OPTIONS,
            instance[key],
          );
          const parameters = this.reflector.get(
            MQTT_SUBSCRIBER_PARAMS,
            instance[key],
          );
          if (subscribeOptions) {
            this.subscribe(
              subscribeOptions,
              parameters,
              instance[key],
              instance,
            );
          }
        },
      );
    });

    this.client.on(
      'message',
      (topic: string, payload: Buffer, packet: Packet) => {
        this.onMessageReceived(topic, payload, packet);
      },
    );
  }

  async onMessageReceived(topic: string, payload: Buffer, packet: Packet) {
    // @SERMAS
    const sermastTopicsList = this.platformTopics.getTopicsList();

    const subscribers = this.getSubscribers(topic);
    if (subscribers.length) {
      for (const subscriber of subscribers) {
        const parameters = subscriber.parameters || [];
        const scatterParameters: MqttSubscriberParameter[] = [];
        for (const parameter of parameters) {
          scatterParameters[parameter.index] = parameter;
        }
        try {
          const transform = getTransform(subscriber.options.transform);

          // add a option to do something before handle message.
          if (this.options.beforeHandle) {
            this.options.beforeHandle(topic, payload, packet);
          }

          // @SERMAS
          let payload1 = transform(payload);
          if (
            subscriber.options.rawTopics &&
            subscriber.options.rawTopics.length &&
            subscriber.options.rawTopics.filter((rawTopic) =>
              sermastTopicsList.includes(rawTopic),
            ).length
          ) {
            payload1 = payload1 as SermasBaseDto;
            if (subscriber.options.transform === 'json') {
              const appId = extractTopicAppId(topic);
              payload1 = addDTOContext(payload1, { appId });
            }
            subscriber.options.rawTopics.forEach((rawTopic) => {
              this.emitter.emit(`mqtt.sub.${rawTopic}`, payload1);
            });
          }
          // /@SERMAS

          subscriber.handle.bind(subscriber.provider)(
            ...scatterParameters.map((parameter) => {
              switch (parameter?.type) {
                case 'payload':
                  return payload1;
                case 'topic':
                  return topic;
                case 'packet':
                  return packet;
                case 'params':
                  return MqttExplorer.matchGroups(topic, subscriber.regexp);
                default:
                  return null;
              }
            }),
          );
        } catch (err) {
          this.logger.error(`onMessageReceived: ${err.stack}`);
        }
      }
    }
  }

  private getSubscribers(topic: string): MqttSubscriber[] {
    const matches: MqttSubscriber[] = [];
    for (const subscriber of this.subscribers) {
      subscriber.regexp.lastIndex = 0;
      if (subscriber.regexp.test(topic)) {
        matches.push(subscriber);
      }
    }
    return matches;
  }

  private static topicToRegexp(topic: string) {
    // compatible with emqtt
    return new RegExp(
      '^' +
        topic
          .replace('$queue/', '')
          .replace(/^\$share\/([A-Za-z0-9]+)\//, '')
          .replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g, '\\$1')
          .replace(/\+/g, '([^/]+)')
          .replace(/\/#$/, '(/.*)?') +
        '$',
      'y',
    );
  }

  private static matchGroups(str: string, regex: RegExp) {
    regex.lastIndex = 0;
    let m = regex.exec(str);
    const matches: string[] = [];

    while (m !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if (groupIndex !== 0) {
          matches.push(match);
        }
      });
      m = regex.exec(str);
    }
    return matches;
  }

  addSubscriber(
    options: MqttSubscribeOptions,
    parameters: MqttSubscriberParameter[],
    handle,
    provider,
  ) {
    const topicList = Array.isArray(options.topic)
      ? options.topic
      : [options.topic];
    topicList.forEach((topic) => {
      this.subscribers.push({
        topic,
        route: topic
          .replace('$queue/', '')
          .replace(/^\$share\/([A-Za-z0-9]+)\//, ''),
        regexp: MqttExplorer.topicToRegexp(topic),
        provider,
        handle,
        options,
        parameters,
      });
    });
  }
}
