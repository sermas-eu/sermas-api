import { Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { PlatformTokenDto } from './platform.token.dto';

@AsyncApi()
@Injectable()
export class PlatformTokenAsyncApiService {
  private readonly logger = new Logger(PlatformTokenAsyncApiService.name);
  constructor(private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.platform.tokenRequested,
    message: {
      payload: PlatformTokenDto,
    },
    description: 'Publish an update when a new access token is requested event',
  })
  async tokenRequested(payload: PlatformTokenDto) {
    this.broker.publish(SermasTopics.platform.tokenRequested, payload);
  }
}
