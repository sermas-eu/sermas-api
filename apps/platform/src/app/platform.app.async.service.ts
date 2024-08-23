import { Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import {
  PlatformAppChangedDto,
  PlatformAppClientChangedDto,
} from './platform.app.dto';

@AsyncApi()
@Injectable()
export class PlatformAppAsyncApiService {
  private readonly logger = new Logger(PlatformAppAsyncApiService.name);
  constructor(private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.platform.appChanged,
    message: {
      payload: PlatformAppChangedDto,
    },
    description: 'Publish an app changed event',
  })
  async appChanged(payload: PlatformAppChangedDto) {
    this.broker.publish(SermasTopics.platform.appChanged, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.platform.clientChanged,
    message: {
      payload: PlatformAppClientChangedDto,
    },
    description: 'Publish a client app changed event',
  })
  async clientChanged(payload: PlatformAppClientChangedDto) {
    this.broker.publish(SermasTopics.platform.clientChanged, payload);
  }
}
