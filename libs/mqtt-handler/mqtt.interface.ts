import { IClientOptions, Packet } from 'mqtt';
import { LoggerService, Type } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';

export type MqttMessageTransformer = (payload: Buffer) => any;

export type LoggerConstructor = new (...params) => LoggerService;

export interface MqttSubscribeOptions {
  rawTopics?: string[];
  topic: string | string[];
  queue?: boolean;
  share?: string;
  transform?: 'json' | 'text' | MqttMessageTransformer;
  args?: Record<string, string>;
}

export interface MqttSubscriberParameter {
  index: number;
  type: 'payload' | 'topic' | 'packet' | 'params';
  transform?: 'json' | 'text' | MqttMessageTransformer;
}

export interface MqttSubscriber {
  topic: string;
  handle: any;
  route: string;
  provider: any;
  regexp: RegExp;
  options: MqttSubscribeOptions;
  parameters: MqttSubscriberParameter[];
}

export interface MqttLoggerOptions {
  useValue?: LoggerService;
  useClass?: Type<LoggerService>;
}

export interface AdvancedOptions {
  authUrl: string;
  clientId: string;
  clientSecret: string;
  interval: number;
}

export interface MqttModuleOptions extends IClientOptions {
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakServiceAccountClientId: string;
  keycloakClientSecret: string;
  keycloakServiceAccountUsername: string;
  keycloakServiceAccountPassword: string;
  // refreshTokenInterval: string;
  /**
   * Global queue subscribe.
   * All topic will be prepend '$queue/' prefix automatically.
   * More information is here:
   * https://docs.emqx.io/broker/latest/cn/advanced/shared-subscriptions.html
   */
  queue?: boolean;

  /**
   * Global shared subscribe.
   * All topic will be prepend '$share/group/' prefix automatically.
   * More information is here:
   * https://docs.emqx.io/broker/latest/cn/advanced/shared-subscriptions.html
   */
  share?: string;

  logger?: MqttLoggerOptions;

  beforeHandle?: (topic: string, payload: Buffer, packet: Packet) => any;
}

export interface MqttOptionsFactory {
  createMqttConnectOptions(): Promise<MqttModuleOptions> | MqttModuleOptions;
}

export interface MqttModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useExisting?: Type<MqttOptionsFactory>;
  useClass?: Type<MqttOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<MqttModuleOptions> | MqttModuleOptions;
  logger?: MqttLoggerOptions;
  advancedOptions?: AdvancedOptions;
}
