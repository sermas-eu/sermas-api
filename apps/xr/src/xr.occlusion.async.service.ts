import { Inject, Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { XROcclusionDto } from './xr.occlusion.dto';

@AsyncApi()
@Injectable()
export class XROcclusionAsyncApiService {
  private readonly logger = new Logger(XROcclusionAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.xr.occlusion,
    message: {
      payload: XROcclusionDto,
    },
    description: 'Hide the agent model when occluded by a physical obstacle',
  })
  async occluded(payload: XROcclusionDto) {
    this.broker.publish(SermasTopics.xr.occlusion, payload);
  }
}
