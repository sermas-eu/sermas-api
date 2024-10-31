import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { convertRawToWav, convertWav } from 'libs/language/audio';

import { SermasSessionDto } from 'libs/sermas/sermas.dto';
import { DialogueAsyncApiService } from './dialogue.async.service';
import { DialogueEmotionService } from './dialogue.emotion.service';

import { SpeechBrainService } from 'apps/detection/src/providers/speechbrain/speechbrain.service';
import { SessionService } from 'apps/session/src/session.service';
import { UIContentDto } from 'apps/ui/src/ui.content.dto';
import { uiContentToText } from 'apps/ui/src/util';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { getChunkId, getMessageId } from 'libs/sermas/sermas.utils';
import { DialogueSpeechToTextDto } from 'libs/stt/stt.dto';
import { STTProviderService } from 'libs/stt/stt.provider.service';
import { DialogueTextToSpeechDto } from 'libs/tts/tts.dto';
import { TTSProviderService } from 'libs/tts/tts.provider.service';
import { LLMTranslationService } from '../../../libs/translation/translation.service';
import { DialogueChatService } from './dialogue.chat.service';

const STT_MESSAGE_CACHE = 30 * 1000; // 30 sec

type OutgoingQueueMessage = { message: DialogueMessageDto; data: Buffer };

@Injectable()
export class DialogueSpeechService {
  private readonly logger = new Logger(DialogueSpeechService.name);

  private sttMessagesCache: Record<string, Date> = {};

  outgoingMessageSemaphore: Set<string> = new Set<string>();
  outgoingMessageQueue: Record<
    string,
    Record<string, Promise<OutgoingQueueMessage>>
  > = {};

  constructor(
    private readonly emotion: DialogueEmotionService,

    private readonly ttsProvider: TTSProviderService,

    private readonly sttProvider: STTProviderService,

    private readonly translation: LLMTranslationService,
    private readonly configService: ConfigService,
    private readonly emitter: EventEmitter2,
    private readonly asyncApi: DialogueAsyncApiService,
    private readonly session: SessionService,

    private readonly llmProvider: LLMProviderService,
    private readonly chatProvider: DialogueChatService,

    private readonly speechbrainProvider: SpeechBrainService,

    private readonly monitor: MonitorService,
  ) {}

  private async replyToUser(
    messageInEnglish: string,
    dialogueMessagePayload: DialogueMessageDto,
  ) {
    const agentMessage = await this.translateMessage(
      {
        ...dialogueMessagePayload,
        text: messageInEnglish,
        language: 'en-GB',
      },
      dialogueMessagePayload.language,
    );

    const ttsEvent: DialogueMessageDto = {
      ...dialogueMessagePayload,
      text: agentMessage,
      actor: 'agent',
    };

    this.asyncApi.dialogueMessages(ttsEvent);
    this.emitter.emit('dialogue.chat.message', ttsEvent);
    // perf('convertToText.empty-text');
  }

  async translateMessage(
    payload: DialogueMessageDto,
    toLanguage?: string,
  ): Promise<string> {
    if (!toLanguage) {
      toLanguage = await this.session.getLanguage(payload, false);
    }

    if (!toLanguage) return payload.text;

    const fromLanguage = payload.language;

    // handle partial language names to match cases such as en == en-US
    if (
      fromLanguage &&
      toLanguage &&
      fromLanguage.split('-')[0] === toLanguage.split('-')[0]
    ) {
      return payload.text;
    }

    try {
      let translation: string;
      const provider = this.configService.get('TRANSLATION_SERVICE');
      switch (provider) {
        case 'openai':
        case 'chatgpt':
        default:
          translation = await this.translation.translate(
            payload.text,
            payload.language,
            toLanguage,
          );
          break;
      }
      return translation;
    } catch (e: any) {
      this.logger.error(`Failed to translate: ${e.stack}`);
      return payload.text;
    }
  }

  async textToSpeech(payload: DialogueTextToSpeechDto): Promise<Buffer> {
    return await this.ttsProvider.generateTTS(payload);
  }

  async hasMultipleSpeakers(ev: DialogueSpeechToTextDto) {
    const counter = await this.speechbrainProvider.countSpeakers(ev.buffer);
    if (
      counter &&
      counter.speakerCount.value != 1 &&
      counter.speakerCount.probability > 0.5
    ) {
      this.logger.warn(
        `STT aborted: ${counter.speakerCount.value} speakers detected for sessionId=${ev.sessionId}`,
      );

      if (!this.sttMessagesCache[ev.sessionId]) {
        this.sttMessagesCache[ev.sessionId] = new Date();
      } else {
        if (
          Date.now() - this.sttMessagesCache[ev.sessionId].getTime() <
          STT_MESSAGE_CACHE
        ) {
          return true;
        } else {
          // reset cache
          delete this.sttMessagesCache[ev.sessionId];
        }
      }

      await this.replyToUser(
        'Sorry, could you retry? If the room is too noisy, please use the keyboard',
        ev,
      );

      return true;
    }
    return false;
  }

  async speechToText(ev: DialogueSpeechToTextDto): Promise<void> {
    const isWav = ev.mimetype === 'audio/wav';

    const perf = this.monitor.performance({
      ...ev,
      label: isWav ? 'stt-convert-wavfile' : 'stt-convert-sox',
    });

    try {
      // if (isNodeEnv('development')) {
      //   await writeFileSync('./data/raw.wav', ev.buffer);
      // }

      if (isWav) {
        ev.buffer = await convertWav(ev.buffer);
      } else {
        ev.buffer = await convertRawToWav(ev.buffer, ev.sampleRate);
      }

      // if (isNodeEnv('development')) {
      //   await writeFileSync('./data/input.wav', ev.buffer);
      // }
    } catch (e: any) {
      this.logger.error(`Failed to convert to WAV: ${e.message}`);
    } finally {
      perf();
    }

    const skip = await this.hasMultipleSpeakers(ev);
    if (skip) return;

    this.emitter.emit('dialogue.speech.audio', ev);
  }

  async chat(ev: DialogueMessageDto): Promise<void> {
    this.logger.verbose(
      `Received chat message actor=${ev.actor} sessionId=${ev.sessionId} appId=${ev.appId}`,
    );
    this.emitter.emit('dialogue.chat.message', ev);
  }

  async convertToText(payload: DialogueSpeechToTextDto) {
    try {
      // set default
      if (!payload.language) {
        payload.language = await this.session.getLanguage(payload);
      }

      const { text, dialogueMessagePayload } =
        await this.sttProvider.convertToText(payload);

      if (!text) {
        this.logger.warn(`STT failed: cannot detect text from audio clip.`);
        // await this.replyToUser(
        //   'Sorry, could you retry?',
        //   dialogueMessagePayload,
        // );
        return;
      }

      this.logger.verbose(`STT result: [${payload.language}] ${text}`);
      // this.dataset.saveRecord('stt', text, buffer, clientId, 'wav');

      const emotion = this.emotion.getUserEmotion(
        dialogueMessagePayload.sessionId,
      );

      this.logger.verbose(`User main emotion: ${emotion}`);

      const ttsEvent: DialogueMessageDto = {
        ...dialogueMessagePayload,
        actor: 'user',
        emotion,
        text,
      };

      this.emitter.emit('dialogue.chat.message', ttsEvent);
      this.asyncApi.dialogueMessages(ttsEvent);
    } catch (err) {
      const { dialogueMessagePayload, language } = err as {
        dialogueMessagePayload: DialogueMessageDto;
        language: string;
      };
      if (!dialogueMessagePayload.language) {
        dialogueMessagePayload.language = language;
      }
      await this.replyToUser('Sorry, could you retry?', dialogueMessagePayload);
    }
  }

  async handleMessage(ev: DialogueMessageDto): Promise<void> {
    // user message
    if (ev.actor === 'user') {
      try {
        this.emitter.emit('dialogue.chat.message.user', ev);
        await this.handleUserMessage(ev);
      } catch (e) {
        this.logger.error(`Failed to handle user message: ${e.stack}`);
      }
      return;
    }

    try {
      await this.handleAgentMessage(ev);
    } catch (e) {
      this.logger.error(`Failed to handle agent message: ${e.stack}`);
    }
  }

  async handleAgentMessage(ev: DialogueMessageDto) {
    const sessionLanguage = await this.session.getLanguage(ev);

    // agent message
    let translation = ev.text;
    if (ev.language !== sessionLanguage) {
      translation = await this.translateMessage(ev);
    }

    const avatar = await this.session.getAvatar(ev);

    const agentResponseEvent: DialogueMessageDto = {
      ...ev,
      gender: avatar?.gender,
      messageId: ev.messageId || getMessageId(ev.ts),
      chunkId: ev.chunkId || getChunkId(ev.ts),
      text: translation,
      language: sessionLanguage,
    };

    await this.sendAgentSpeech(agentResponseEvent);

    this.emitter.emit('dialogue.chat.message.agent', agentResponseEvent);
    this.asyncApi.dialogueMessages(agentResponseEvent);
  }

  protected async processAgentSpeech(
    agentResponseEvent: DialogueMessageDto,
  ): Promise<Buffer | undefined> {
    let buffer: Buffer;
    try {
      buffer = await this.ttsProvider.generateTTS(agentResponseEvent);
    } catch (e) {
      this.logger.error(`Failed to generate agent speech: ${e.stack}`);
      return;
    }

    if (!buffer.length) {
      return;
    }

    return buffer;
  }

  async sendAgentSpeech(message: DialogueMessageDto) {
    message.ts = message.ts ? new Date(message.ts) : new Date();

    message.chunkId = message.chunkId || getChunkId(message.ts);
    message.messageId = message.messageId || getMessageId(message.ts);

    if (message.text) {
      message.text
        .split('\n')
        .forEach((t) => this.logger.verbose(`TTS | ${t}`));
    }

    const promise = this.processAgentSpeech(message)
      .then((data) => Promise.resolve({ data, message }))
      .catch(() => Promise.resolve({ data: null, message }));

    // console.warn(`+ chunkId=${message.chunkId} message=${message.text}`);

    this.addToOutgoingQueue(message.sessionId, message.chunkId, promise);
  }

  async addToOutgoingQueue(
    sessionId: string,
    chunkId: string,
    loader: Promise<OutgoingQueueMessage>,
  ) {
    // add to queue
    this.outgoingMessageQueue[sessionId] =
      this.outgoingMessageQueue[sessionId] || {};
    this.outgoingMessageQueue[sessionId][chunkId] = loader;

    this.processOutgoingQueue(sessionId);
  }

  async processOutgoingQueue(sessionId: string) {
    if (this.outgoingMessageSemaphore.has(sessionId)) return;

    const chunks = this.outgoingMessageQueue[sessionId];
    if (!chunks) return;

    const keys = Object.keys(chunks);
    if (!keys.length) return;

    const chunkId = keys[0];

    this.outgoingMessageSemaphore.add(sessionId);

    try {
      const { data, message } = await chunks[chunkId];

      try {
        if (data && data.length) {
          // console.warn(
          //   `sending chunkId=${message.chunkId} message=${message.text}`,
          // );
          await this.asyncApi.agentSpeech(message, data);
        }
      } catch (e) {
        this.logger.error(
          `Failed to send agent speech sessionId=${message.sessionId}: ${e.stack}`,
        );
      }
    } catch (e) {
      this.logger.error(`Failed to process agent speech: ${e.stack}`);
    } finally {
      delete this.outgoingMessageQueue[sessionId][chunkId];

      this.outgoingMessageSemaphore.delete(sessionId);
      this.processOutgoingQueue(sessionId);
    }
  }

  async handleUserMessage(message: DialogueMessageDto) {
    const emotion = this.emotion.getUserEmotion(message.sessionId);
    if (emotion) message.emotion = emotion;
    await this.chatProvider.inference(message);
  }

  async stopAgentSpeech(ev: SermasSessionDto) {
    this.emitter.emit('dialogue.chat.stop', ev);
    this.asyncApi.agentStopSpeech(ev);
  }

  async readUiContent(payload: UIContentDto) {
    if (!payload.options?.ttsEnabled) return;

    const text = uiContentToText(payload, {
      format: 'tts',
      withOptions: false,
    });
    if (!text) return;

    const settings = await this.session.getSettings(payload);

    // skip tts generation
    if (settings && settings?.ttsEnabled === false) return;

    const avatar = await this.session.getAvatar(payload);
    const gender = avatar.gender;

    const language = await this.session.getLanguage(payload);

    const dialogueMessagePayload: DialogueMessageDto = {
      text,
      actor: 'agent',
      appId: payload.appId,
      clientId: payload.clientId,
      sessionId: payload.sessionId,
      gender,
      llm: settings.llm,
      ts: payload.ts || new Date(),
      chunkId: payload.chunkId || getChunkId(payload.ts),
      language,
    };

    await this.sendAgentSpeech(dialogueMessagePayload);
  }

  listModels() {
    return this.llmProvider.listModels();
  }
}
