import { Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { DialogueSpeechToTextDto } from 'libs/stt/stt.dto';
import { mapMqttTopic } from 'libs/util';
import { AsyncApi } from 'nestjs-asyncapi';
import { DialogueSessionRequestDto } from './dialogue.request-monitor.dto';
import { DialogueAvatarSpeechControlDto } from './dialogue.speech.dto';

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
      payload: DialogueAvatarSpeechControlDto,
    },
    description: 'Publish a stop speaking command for the agent',
  })
  async agentStopSpeech(payload: DialogueAvatarSpeechControlDto) {
    this.broker.publish(SermasTopics.dialogue.agentStopSpeech, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.agentPauseSpeech,
    message: {
      payload: DialogueAvatarSpeechControlDto,
    },
    description: 'Publish a pause speaking command for the agent',
  })
  async agentPauseSpeech(payload: DialogueAvatarSpeechControlDto) {
    this.broker.publish(SermasTopics.dialogue.agentPauseSpeech, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.agentContinueSpeech,
    message: {
      payload: DialogueAvatarSpeechControlDto,
    },
    description: 'Publish a continue speaking command for the agent',
  })
  async agentContinueSpeech(payload: DialogueAvatarSpeechControlDto) {
    this.broker.publish(SermasTopics.dialogue.agentContinueSpeech, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.userSpeech,
    message: {
      payload: DialogueSpeechToTextDto,
    },
    description: 'Publish a stop speaking command for the agent',
  })
  async userSpeech(payload: DialogueSpeechToTextDto) {
    this.broker.publish(SermasTopics.dialogue.agentStopSpeech, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.request,
    message: {
      payload: DialogueSessionRequestDto,
    },
    description: 'Publish a stop speaking command for the agent',
  })
  async request(payload: DialogueSessionRequestDto) {
    this.broker.publish(SermasTopics.dialogue.request, payload);
  }
}
