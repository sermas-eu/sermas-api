import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { SessionService } from 'apps/session/src/session.service';
import { UIContentDto } from 'apps/ui/src/ui.content.dto';
import { UIInteractionEventDto } from 'apps/ui/src/ui.dto';
import {
  UiInteractionButtonDto,
  UiInteractionQuizDto,
} from 'apps/ui/src/ui.interaction.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { Payload, Subscribe, Topic } from 'libs/mqtt-handler/mqtt.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { getChunkId } from 'libs/sermas/sermas.utils';
import {
  DialogueChatProgressEvent,
  DialogueChatValidationEvent,
} from './chat/dialogue.chat.dto';
import { DialogueAsyncApiService } from './dialogue.async.service';
import { DialogueSessionRequestEvent } from './dialogue.request-monitor.dto';
import { DialogueRequestMonitorService } from './dialogue.request-monitor.service';
import { DialogueSpeechService } from './dialogue.speech.service';
import { DialogueWelcomeService } from './dialogue.speech.welcome.service';
import { DialogueSpeechStreamService } from './speech-stream/dialogue.speech.stream.service';

@Injectable()
export class DialogueSpeechEventService {
  private readonly logger = new Logger(DialogueSpeechEventService.name);

  constructor(
    @Inject(MqttService) private readonly mqttService: MqttService,
    private session: SessionService,
    private speech: DialogueSpeechService,
    private welcome: DialogueWelcomeService,
    private async: DialogueAsyncApiService,
    private readonly requestMonitor: DialogueRequestMonitorService,
    private readonly speechStream: DialogueSpeechStreamService,
  ) {}

  @Subscribe({
    topic: SermasTopics.dialogue.userSpeechStream,
    transform: (raw) => raw,
  })
  // Collect user speech as streaming frames
  async collectAudioFrames(@Topic() topic: string, @Payload() buffer: Buffer) {
    await this.speechStream.processStreamFrame(topic, buffer);
  }

  @Subscribe({
    topic: SermasTopics.dialogue.userSpeech,
    transform: (raw) => raw,
  })
  // Collect user speech as complete message
  async collectAudio(@Topic() topic: string, @Payload() buffer: Buffer) {
    await this.speechStream.processChunk(topic, buffer);
  }

  @Subscribe({
    topic: SermasTopics.ui.interaction,
  })
  // Add content to chat after user interact with UI
  async addUserInteractionAsChatMessage(
    @Payload() payload: UIInteractionEventDto,
  ) {
    if (!payload.sessionId) return;

    if (payload.interaction.element === 'navigation-menu') {
      return;
    }

    const message: DialogueMessageDto = {
      actor: 'user',
      appId: payload.appId,
      sessionId: payload.sessionId,
      text: payload.interaction.value,
      messageId: getChunkId(),
      chunkId: getChunkId(),
      language: null,
      ts: payload.ts || new Date(),
    };

    if (payload.interaction.element === 'button') {
      const buttonInteraction = payload.interaction as UiInteractionButtonDto;
      message.text =
        buttonInteraction.context.button.label ||
        buttonInteraction.context.button.value;
    }

    if (payload.interaction.element === 'quiz') {
      const quizInteraction = payload.interaction as UiInteractionQuizDto;
      message.text = quizInteraction.value;
    }

    await this.async.dialogueMessages(message);
  }

  @OnEvent('session.request')
  async onSessionRequest(ev: DialogueSessionRequestEvent) {
    this.requestMonitor.updateRequestStatus(ev);
  }

  @OnEvent('session.changed')
  async handleWelcomeText(ev: SessionChangedDto) {
    this.welcome.handleWelcomeText(ev);
    this.speech.handleSessionChanged(ev);
  }

  // @OnEvent('dialogue.speech.audio')
  // async convertToText(payload: DialogueSpeechToTextDto) {
  //   //
  // }

  @OnEvent('dialogue.chat.message')
  async handleMessage(ev: DialogueMessageDto): Promise<void> {
    this.speech.handleMessage(ev);
  }

  @OnEvent('dialogue.chat.progress')
  async onChatProgress(ev: DialogueChatProgressEvent): Promise<void> {
    this.speech.onChatProgress(ev);
  }

  @OnEvent('dialogue.chat.validation')
  async onSkipResponse(ev: DialogueChatValidationEvent): Promise<void> {
    this.speech.onUserMessageValidation(ev);
  }

  @OnEvent('ui.content')
  readUiContent(ev: UIContentDto) {
    this.speech.readUiContent(ev);
  }
}
