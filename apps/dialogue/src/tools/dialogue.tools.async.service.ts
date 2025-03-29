import { Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { mapMqttTopic } from 'libs/util';
import { AsyncApi } from 'nestjs-asyncapi';
import { DialogueToolNotMatchingEventDto } from '../chat/dialogue.chat.dto';
import {
  DialogueToolTriggeredEventDto,
  DialogueToolsRepositoryChanged,
} from './dialogue.tools.dto';

@AsyncApi()
@Injectable()
export class DialogueToolsAsyncApiService {
  private readonly logger = new Logger(DialogueToolsAsyncApiService.name);
  constructor(private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.toolTriggered,
    message: {
      payload: DialogueToolTriggeredEventDto,
    },
    description: 'Publish the tool that triggered from the user prompt',
  })
  async toolTriggered(payload: DialogueToolTriggeredEventDto) {
    this.broker.publish(SermasTopics.dialogue.toolTriggered, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.toolChanged,
    message: {
      payload: DialogueToolsRepositoryChanged,
    },
    description: 'Publish the updated tools list for a session',
  })
  async toolChanged(payload: DialogueToolsRepositoryChanged) {
    this.broker.publish(
      mapMqttTopic(SermasTopics.dialogue.toolChanged, {
        ...payload,
        ...payload.record,
      }),
      payload,
    );
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.toolNotMatching,
    message: {
      payload: DialogueToolNotMatchingEventDto,
    },
    description: 'Indicate non of the available tools matches the user message',
  })
  async toolNotMatching(payload: DialogueToolNotMatchingEventDto) {
    this.broker.publish(SermasTopics.dialogue.toolNotMatching, payload);
  }
}
