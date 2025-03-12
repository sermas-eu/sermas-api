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
import { DefaultLanguage } from 'libs/language/lang-codes';
import { Payload, Subscribe, Topic } from 'libs/mqtt-handler/mqtt.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { getChunkId } from 'libs/sermas/sermas.utils';
import { DialogueSpeechToTextDto } from 'libs/stt/stt.dto';
import { uuidv4 } from 'libs/util';
import { DialogueAsyncApiService } from './dialogue.async.service';
import { DialogueChatProgressEvent } from './dialogue.chat.dto';
import { DialogueSessionRequestEvent } from './dialogue.request-monitor.dto';
import { DialogueRequestMonitorService } from './dialogue.request-monitor.service';
import { DialogueSpeechService } from './dialogue.speech.service';
import { DialogueWelcomeService } from './dialogue.speech.welcome.service';

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
  ) {}

  @Subscribe({
    topic: SermasTopics.dialogue.userSpeech,
    transform: (raw) => raw,
  })
  // Add content to chat after user interact with UI
  async collectAudio(@Topic() topic: string, @Payload() buffer: Buffer) {
    try {
      const parts = topic.split('/');
      const chunkId = parts.pop();
      const sessionId = parts.pop();

      if (!sessionId) return;

      const session = await this.session.read(sessionId, false);
      if (!session) {
        this.logger.debug(`sessionId=${sessionId} not found`);
        return;
      }

      const settings = session.settings || {};

      const ev: DialogueSpeechToTextDto = {
        appId: session.appId,
        sessionId,
        requestId: uuidv4(),

        buffer,
        mimetype: 'audio/wav',
        sampleRate: undefined,

        clientId: null,
        userId: null,

        actor: 'user',
        text: '',

        llm: settings.llm || undefined,
        avatar: settings.avatar || undefined,
        language: settings.language || DefaultLanguage,

        ts: new Date(),
        chunkId: chunkId,
        ttsEnabled: settings.ttsEnabled === false ? false : true,
      };

      this.logger.debug(`Got user speech sessionId=${sessionId}`);
      await this.speech.speechToText(ev);
    } catch (e) {
      this.logger.error(
        `Failed to process user audio for topic=${topic}: ${e.stack}`,
      );
    }
  }

  @Subscribe({
    topic: SermasTopics.ui.interaction,
  })
  // Add content to chat after user interact with UI
  async addUserInteractionAsChatMessage(
    @Payload() payload: UIInteractionEventDto,
  ) {
    if (!payload.sessionId) return;

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

  @OnEvent('ui.content')
  readUiContent(ev: UIContentDto) {
    this.speech.readUiContent(ev);
  }
}
