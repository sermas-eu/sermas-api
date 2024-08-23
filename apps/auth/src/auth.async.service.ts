import { Inject, Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { UpdateUserEventDto } from './auth.dto';

@AsyncApi()
@Injectable()
export class AuthAsyncApiService {
  private readonly logger = new Logger(AuthAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.auth.update,

    message: {
      payload: UpdateUserEventDto,
    },
    description: 'Subscribe for receving event when user data are updated',
  })
  async userUpdate(payload: UpdateUserEventDto) {
    this.broker.publish(SermasTopics.auth.update, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.auth.create,

    message: {
      payload: UpdateUserEventDto,
    },
    description:
      'Subscribe for receving event when a new user join the the system',
  })
  async userRegistration(payload: UpdateUserEventDto) {
    this.broker.publish(SermasTopics.auth.update, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.auth.login,

    message: {
      payload: UpdateUserEventDto,
    },
    description: 'Subscribe for receving event when a user is logged in',
  })
  async userLogin(payload: UpdateUserEventDto) {
    this.broker.publish(SermasTopics.auth.login, payload);
  }
}
