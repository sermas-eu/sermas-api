import { DynamicModule, Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { KeycloakModule } from '#apps/keycloak/src/keycloak.module';
import { createClientProvider } from './client.provider.js';
import { MQTT_OPTION_PROVIDER } from './mqtt.constants.js';
import { MqttExplorer } from './mqtt.explorer.js';
import { MqttModuleAsyncOptions, MqttModuleOptions } from './mqtt.interface.js';
import { MqttService } from './mqtt.service.js';
import {
  createLoggerProvider,
  createOptionProviders,
} from './options.provider.js';

@Global()
@Module({
  imports: [DiscoveryModule, KeycloakModule],
  exports: [MqttService],
  providers: [MqttService],
})
export class MqttModule {
  public static forRootAsync(options: MqttModuleAsyncOptions): DynamicModule {
    return {
      module: MqttModule,
      providers: [
        ...createOptionProviders(options),
        createLoggerProvider(options),
        createClientProvider(),
        MqttExplorer,
        MqttService,
      ],
    };
  }

  public static forRoot(options: MqttModuleOptions): DynamicModule {
    return {
      module: MqttModule,
      providers: [
        {
          provide: MQTT_OPTION_PROVIDER,
          useValue: options,
        },
        createLoggerProvider(options),
        createClientProvider(),
        MqttExplorer,
        MqttService,
      ],
    };
  }
}
