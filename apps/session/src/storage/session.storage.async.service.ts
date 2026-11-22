import { Inject, Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from '#libs/decorator/asyncapi.operation.decorator';
import { MqttService } from '#libs/mqtt-handler/mqtt.service';
import { SermasTopics } from '#libs/sermas/sermas.topic';
import { AsyncApi } from '#libs/asyncapi/index';
import { SessionStorageEventDto } from './session.storage.dto.js';
@AsyncApi()
@Injectable()
export class SessionStorageAsyncApiService {
  private readonly logger = new Logger(SessionStorageAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.session.storage,
    message: {
      payload: SessionStorageEventDto,
    },
    description: 'Receive updates on storage changes',
  })
  async storageUpdated(payload: SessionStorageEventDto) {
    this.broker.publish(SermasTopics.session.storage, payload);
  }
}
