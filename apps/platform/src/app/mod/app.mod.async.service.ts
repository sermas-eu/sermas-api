import { Inject, Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { PlatformAppModuleConfigEventDto } from './app.mod.dto';

@AsyncApi()
@Injectable()
export class PlatformAppModuleAsyncApiService {
  private readonly logger = new Logger(PlatformAppModuleAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.platform.appModuleChanged,
    message: {
      payload: PlatformAppModuleConfigEventDto,
    },
    description: 'Publish an app module change event',
  })
  async appModuleChanged(payload: PlatformAppModuleConfigEventDto) {
    this.broker.publish(SermasTopics.platform.appModuleChanged, payload);
  }
}
