import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { convertRawToWav, convertWav } from 'libs/language/audio';

import { SermasSessionDto } from 'libs/sermas/sermas.dto';
import { DialogueAsyncApiService } from './dialogue.async.service';
import { DialogueEmotionService } from './dialogue.emotion.service';

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

@Injectable()
export class DialogueSpeechService {
  private readonly logger = new Logger(DialogueSpeechService.name);

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

    private readonly monitor: MonitorService,
  ) {}

  async textToSpeech(payload: DialogueTextToSpeechDto): Promise<Buffer> {
    return await this.ttsProvider.generateTTS(payload);
  }

  async translateMessage(
    payload: DialogueMessageDto,
    targetLanguage?: string,
  ): Promise<string> {
    if (!targetLanguage) {
      targetLanguage = await this.session.getLanguage(payload, false);
    }

    if (!targetLanguage) return payload.text;

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
            targetLanguage,
          );
          break;
      }
      return translation;
    } catch (e: any) {
      this.logger.error(`Failed to translate: ${e.stack}`);
      return payload.text;
    }
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

    this.emitter.emit('dialogue.speech.audio', ev);
  }

  async chat(ev: DialogueMessageDto): Promise<void> {
    this.logger.debug(
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
        this.logger.warn(`cannot detect text from audio clip.`);

        // const agentMessage = await this.translateMessage(
        //   {
        //     ...dialogueMessagePayload,
        //     text: 'Sorry, could you repeat?',
        //     language: 'en-GB',
        //   },
        //   dialogueMessagePayload.language,
        // );

        // const ttsEvent = {
        //   ...dialogueMessagePayload,
        //   text: agentMessage,
        // };

        // this.asyncApi.dialogueMessages(ttsEvent);
        // this.emitter.emit('dialogue.chat.message', ttsEvent);
        // perf('convertToText.empty-text');

        return;
      }

      this.logger.log(`STT result: [${payload.language}] ${text}`);
      // this.dataset.saveRecord('stt', text, buffer, clientId, 'wav');

      const emotion = this.emotion.getUserEmotion(
        dialogueMessagePayload.sessionId,
      );

      this.logger.log(`User main emotion: ${emotion}`);

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

      const errorMessage = await this.translateMessage(
        {
          ...dialogueMessagePayload,
          text: 'Sorry, could you retry ?',
          language: 'en-GB',
        },
        language,
      );

      const ttsEvent: DialogueMessageDto = {
        ...dialogueMessagePayload,
        text: errorMessage,
      };

      this.asyncApi.dialogueMessages(ttsEvent);
      this.emitter.emit('dialogue.chat.message', ttsEvent);
    }
  }

  async handleMessage(ev: DialogueMessageDto): Promise<void> {
    // user message
    if (ev.actor === 'user') {
      try {
        this.emitter.emit('dialogue.chat.message.user', ev);
        await this.sendPrompt(ev);
      } catch (e) {
        this.logger.error(`LLM request error: ${e.stack}`);
      }
      return;
    }

    const sessionLanguage = await this.session.getLanguage(ev);
    // if (!ev.language) {
    //
    // }

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

  async sendAgentSpeech(agentResponseEvent: DialogueMessageDto) {
    let buffer: Buffer;

    if (agentResponseEvent.text) {
      agentResponseEvent.text
        .split('\n')
        .forEach((t) => this.logger.debug(`TTS | ${t}`));
    }

    try {
      buffer = await this.ttsProvider.generateTTS(agentResponseEvent);
    } catch (e) {
      this.logger.error(`Failed to generate agent speech: ${e.stack}`);
      return;
    }

    if (!buffer.length) {
      return;
    }

    try {
      agentResponseEvent.ts = agentResponseEvent.ts
        ? new Date(agentResponseEvent.ts)
        : new Date();
      agentResponseEvent.chunkId =
        agentResponseEvent.chunkId || getChunkId(agentResponseEvent.ts);
      agentResponseEvent.messageId =
        agentResponseEvent.messageId || getMessageId(agentResponseEvent.ts);

      await this.asyncApi.agentSpeech(agentResponseEvent, buffer);
    } catch (e) {
      this.logger.error(`Failed to send agent speech: ${e.stack}`);
    }
  }

  async sendPrompt(message: DialogueMessageDto) {
    const emotion = this.emotion.getUserEmotion(message.sessionId);
    if (emotion) message.emotion = emotion;
    await this.chatProvider.inference(message);
  }

  async stopAgentSpeech(ev: SermasSessionDto) {
    // console.log('stop message', stopMessage);
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
