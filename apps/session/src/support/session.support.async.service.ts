import { Inject, Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { SessionSupportEventDto } from './session.support.dto';

@AsyncApi()
@Injectable()
export class SessionSupportAsyncApiService {
  private readonly logger = new Logger(SessionSupportAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.session.support,
    message: {
      payload: SessionSupportEventDto,
    },
    description: 'Receive status updates for a support request',
  })
  async support(payload: SessionSupportEventDto) {
    this.broker.publish(SermasTopics.session.support, payload);
  }
}
