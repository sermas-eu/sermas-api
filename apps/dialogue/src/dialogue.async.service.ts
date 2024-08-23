import { Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasSessionDto } from 'libs/sermas/sermas.dto';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { mapMqttTopic } from 'libs/util';
import { AsyncApi } from 'nestjs-asyncapi';

@AsyncApi()
@Injectable()
export class DialogueAsyncApiService {
  private readonly logger = new Logger(DialogueAsyncApiService.name);
  constructor(private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.messages,
    message: {
      payload: DialogueMessageDto,
    },
    description: 'Publish text of the speech exchanges',
  })
  async dialogueMessages(payload: DialogueMessageDto) {
    this.broker.publish(SermasTopics.dialogue.messages, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.agentSpeech,
    message: {
      payload: Buffer,
    },
    description: 'Publish agent message',
  })
  async agentSpeech(payload: DialogueMessageDto, raw: Buffer) {
    const topic = mapMqttTopic(SermasTopics.dialogue.agentSpeech, payload);
    this.broker.publish(topic, raw);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.agentStopSpeech,
    message: {
      payload: SermasSessionDto,
    },
    description: 'Publish a stop speaking command for the agent',
  })
  async agentStopSpeech(payload: SermasSessionDto) {
    this.broker.publish(SermasTopics.dialogue.agentStopSpeech, payload);
  }
}
