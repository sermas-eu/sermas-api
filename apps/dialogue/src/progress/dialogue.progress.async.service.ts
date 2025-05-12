import { Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { DialogueProgressEventDto } from './dialogue.progress.dto';

@AsyncApi()
@Injectable()
export class DialogueProgressAsyncService {
  private readonly logger = new Logger(DialogueProgressAsyncService.name);

  constructor(private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.progress,
    message: {
      payload: DialogueProgressEventDto,
    },
    description: 'Publish dialogue progress event',
  })
  async dialogueProgress(payload: DialogueProgressEventDto) {
    this.broker.publish(SermasTopics.dialogue.progress, payload);
  }
}
