import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { UIContentDto } from 'apps/ui/src/ui.content.dto';
import { UIInteractionEventDto } from 'apps/ui/src/ui.dto';
import { UiInteractionButtonDto } from 'apps/ui/src/ui.interaction.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { getChunkId } from 'libs/sermas/sermas.utils';
import { DialogueSpeechToTextDto } from 'libs/stt/stt.dto';
import { DialogueAsyncApiService } from './dialogue.async.service';
import { DialogueSpeechService } from './dialogue.speech.service';
import { DialogueWelcomeService } from './dialogue.speech.welcome.service';

@Injectable()
export class DialogueSpeechEventService {
  private readonly logger = new Logger(DialogueSpeechEventService.name);
  constructor(
    @Inject(MqttService) private readonly mqttService: MqttService,
    private speech: DialogueSpeechService,
    private welcome: DialogueWelcomeService,
    private async: DialogueAsyncApiService,
  ) {}

  @Subscribe({
    topic: SermasTopics.ui.interaction,
  })
  // Add content to chat after user interact with UI
  async addUserInteractionAsChatMessage(
    @Payload() payload: UIInteractionEventDto,
  ) {
    if (!payload.sessionId) return;

    if (payload.interaction.element === 'button') {
      const buttonInteraction = payload.interaction as UiInteractionButtonDto;
      await this.async.dialogueMessages({
        actor: 'user',
        appId: payload.appId,
        sessionId: payload.sessionId,
        text:
          buttonInteraction.context.button.label ||
          buttonInteraction.context.button.value,
        messageId: getChunkId(),
        chunkId: getChunkId(),
        language: null,
        ts: payload.ts || new Date(),
      });
    }
    if (payload.interaction.element === 'quiz') {
      this.logger.warn('*** TODO add QUIZ response to chat messages ***');
    }
  }

  @OnEvent('session.changed')
  async handleWelcomeText(ev: SessionChangedDto) {
    this.welcome.handleWelcomeText(ev);
  }

  @OnEvent('dialogue.speech.audio')
  async convertToText(payload: DialogueSpeechToTextDto) {
    this.speech.convertToText(payload);
  }

  @OnEvent('dialogue.chat.message', { async: true })
  async handleMessage(ev: DialogueMessageDto): Promise<void> {
    this.speech.handleMessage(ev);
  }

  @OnEvent('ui.content')
  readUiContent(ev: UIContentDto) {
    this.speech.readUiContent(ev);
  }
}
