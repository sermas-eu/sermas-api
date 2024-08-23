import { Inject, Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { ModuleConfigEventDto } from './mod.dto';

@AsyncApi()
@Injectable()
export class PlatformModuleAsyncApiService {
  private readonly logger = new Logger(PlatformModuleAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.platform.moduleChanged,
    message: {
      payload: ModuleConfigEventDto,
    },
    description: 'Publish a platform module change event',
  })
  async moduleChanged(payload: ModuleConfigEventDto) {
    this.broker.publish(SermasTopics.platform.moduleChanged, payload);
  }
}
