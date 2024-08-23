import { Inject, Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { SessionChangedDto, SessionDto } from './session.dto';
@AsyncApi()
@Injectable()
export class SessionAsyncApiService {
  private readonly logger = new Logger(SessionAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.session.userInteraction,
    message: {
      payload: SessionDto,
    },
    description: 'Publish a status update for a user interaction',
  })
  async userInteraction(payload: SessionDto) {
    this.broker.publish(SermasTopics.session.userInteraction, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.session.sessionChanged,
    message: {
      payload: SessionChangedDto,
    },
    description: 'Publish an update for a session record update',
  })
  async sessionChanged(payload: SessionChangedDto) {
    this.broker.publish(SermasTopics.session.sessionChanged, payload);
  }
}
