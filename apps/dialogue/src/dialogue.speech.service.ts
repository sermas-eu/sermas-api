import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { convertRawToWav, convertWav } from 'libs/language/audio';

import { DialogueAsyncApiService } from './dialogue.async.service';
import { DialogueEmotionService } from './dialogue.emotion.service';

import { IdentityTrackerService } from 'apps/detection/src/providers/identify-tracker/identity-tracker.service';
import { SpeechBrainService } from 'apps/detection/src/providers/speechbrain/speechbrain.service';
import { createSessionContext } from 'apps/session/src/session.context';
import { SessionChangedDto } from 'apps/session/src/session.dto';
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
import {
  DialogueChatProgressEvent,
  DialogueChatValidationEvent,
} from './chat/dialogue.chat.dto';
import { DialogueChatService } from './chat/dialogue.chat.service';
import {
  DialogueSessionRequestEvent,
  DialogueSessionRequestStatus,
} from './dialogue.request-monitor.dto';
import { DialogueRequestMonitorService } from './dialogue.request-monitor.service';
import {
  DialogueAvatarSpeechControlDto,
  OutgoingChunkQueue,
  OutgoingQueueMessage,
} from './dialogue.speech.dto';
import { DialogueMemoryService } from './memory/dialogue.memory.service';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';

const STT_MESSAGE_CACHE = 30 * 1000; // 30 sec

@Injectable()
export class DialogueSpeechService implements OnModuleInit {
  private readonly logger = new Logger(DialogueSpeechService.name);

  private sttMessagesCache: Record<string, Date> = {};

  outgoingMessageSemaphore: Set<string> = new Set<string>();
  outgoingMessageQueue: Record<string, OutgoingChunkQueue> = {};

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

    private readonly memory: DialogueMemoryService,

    private readonly speechbrainProvider: SpeechBrainService,

    private readonly identiyTracker: IdentityTrackerService,

    private readonly monitor: MonitorService,
    private readonly requestMonitor: DialogueRequestMonitorService,

    private readonly broker: MqttService,
  ) {}

  onModuleInit() {
    if (this.configService.get('SPEAKER_VERIFICATION') == '0') {
      this.logger.warn(
        `Speaker verification disabled. To enable set SPEAKER_VERIFICATION env to 1`,
      );
    }
    if (this.configService.get('SPEAKER_COUNTER') == '0') {
      this.logger.warn(
        `Speaker counter disabled. To enable set SPEAKER_COUNTER env to 1`,
      );
    }
  }

  private async replyToUser(
    messageInEnglish: string,
    dialogueMessagePayload: DialogueMessageDto,
  ) {
    if (!this.isRequestOngoing(dialogueMessagePayload)) {
      return;
    }

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
      this.logger.debug(`Translating ${fromLanguage} -> ${toLanguage}`);
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
            createSessionContext(payload),
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
    if (this.configService.get('SPEAKER_COUNTER') == '0') {
      return false;
    }
    const counter = await this.speechbrainProvider.countSpeakers(ev.buffer);
    if (
      counter &&
      counter.speakerCount.value > 2 &&
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
        'I cannot understand, could you try to use the keyboard',
        ev,
      );

      return true;
    }
    return false;
  }

  private trackRequest(
    status: DialogueSessionRequestStatus,
    ev: Omit<DialogueSessionRequestEvent, 'status'>,
  ) {
    if (!ev.requestId) return;

    // track overall request processing time
    this.emitter.emit('session.request', {
      ...ev,
      requestId: ev.requestId,
      status,
    });
  }

  async convert(ev: DialogueSpeechToTextDto): Promise<Buffer> {
    if (this.configService.get('SKIP_AUDIO_CONVERSION') == '1') {
      this.logger.warn(
        `Skipping audio conversion, remove SKIP_AUDIO_CONVERSION env`,
      );
      return ev.buffer;
    }
    let buffer: Buffer;
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
        buffer = await convertWav(ev.buffer);
      } else {
        buffer = await convertRawToWav(ev.buffer, ev.sampleRate);
      }

      // if (isNodeEnv('development')) {
      //   await writeFileSync('./data/input.wav', ev.buffer);
      // }
    } catch (e: any) {
      this.logger.error(`Failed to convert to WAV: ${e.message}`);
    } finally {
      perf();
    }
    return buffer;
  }

  async speechToText(ev: DialogueSpeechToTextDto): Promise<void> {
    // track request
    this.trackRequest('started', ev);
    await this.asyncApi.dialogueProgress({
      event: 'stt',
      sessionId: ev.sessionId,
      appId: ev.appId,
    });

    ev.buffer = await this.convert(ev);

    const promise = Promise.all([
      await this.isExpectedSpeaker(ev.sessionId, ev.buffer),
      await this.hasMultipleSpeakers(ev),
    ]);

    this.emitter.emit('dialogue.speech.audio', ev);

    const ok = await this.convertToText(ev, () => promise);

    if (ok) {
      // cancel active requests, excepts for the current one
      this.requestMonitor.cancelRequests(ev.sessionId, ev.requestId);
    }
  }

  async isExpectedSpeaker(sessionId: string, audio: Buffer): Promise<boolean> {
    if (this.configService.get('SPEAKER_VERIFICATION') == '0') {
      return true;
    }
    const embeddings = [
      this.identiyTracker.getAgentEmbedding(sessionId),
      this.identiyTracker.getSpeakerEmbedding(sessionId),
    ];
    const res = await this.identiyTracker.verifySpeaker(audio, embeddings);
    if (!res) return true;
    // collect user audio embeddings
    this.identiyTracker.update(sessionId, res.embeddings);
    if (res.results[0] == true) {
      this.logger.debug('Agent self-speaking, skip');
      return false;
    }
    if (embeddings[1] == '') return true; // no result expected
    this.logger.debug(`${res.results[1] ? 'Same' : 'Different'} speaker`);
    return res.results[1];
  }

  async handleSessionChanged(ev: SessionChangedDto) {
    if (ev.operation !== 'updated') return;
    if (!ev.record?.sessionId) return;
    // only if closed
    if (!ev.record?.closedAt) return;

    this.identiyTracker.clearSessionEmbeddings(ev.record.sessionId);
  }

  async chat(ev: DialogueMessageDto): Promise<void> {
    // track request
    this.trackRequest('started', ev);

    this.logger.verbose(
      `Received chat message actor=${ev.actor} sessionId=${ev.sessionId} appId=${ev.appId}`,
    );
    this.emitter.emit('dialogue.chat.message', ev);
  }

  private isRequestOngoing(payload: {
    sessionId?: string;
    requestId?: string;
  }) {
    // skip with no requestId indication, e.g. api generated messages
    if (!payload.requestId) return true;

    // drop request if not active
    const isActive = this.requestMonitor.isRequestActive(
      payload.sessionId,
      payload.requestId,
    );

    const isCancelled = this.requestMonitor.isRequestCancelled(
      payload.sessionId,
      payload.requestId,
    );

    // ignore untracked requests, like api generated messages
    if (isActive === undefined && isCancelled === undefined) {
      return true;
    }

    const isOngoing = isActive || !isCancelled;

    if (!isOngoing) {
      this.logger.debug(
        `Dropping request status=${this.requestMonitor.getRequestStatus(
          payload.sessionId,
          payload.requestId,
        )} requestId=${payload.requestId} sessionId=${payload.sessionId}`,
      );
    }

    return isOngoing;
  }

  async onUserMessageValidation(payload: DialogueChatValidationEvent) {
    if (payload.skip) {
      await this.continueAgentSpeech(payload.appId, payload.sessionId);
      return;
    }

    await this.stopAgentSpeech({
      ...payload,
      chunkId: payload.message.chunkId,
    });

    // emit user message
    this.emitter.emit('dialogue.chat.message.user', payload.message);
    await this.asyncApi.dialogueMessages(payload.message);
  }

  async convertToText(
    payload: DialogueSpeechToTextDto,
    validAudioChecks?: () => Promise<boolean[]>,
  ): Promise<boolean> {
    try {
      // set default
      if (!payload.language) {
        payload.language = await this.session.getLanguage(payload);
      }

      const { text, dialogueMessagePayload } =
        await this.sttProvider.convertToText(payload);

      // parallelize audio checks with speechbrain

      let validSpeaker = false;
      if (validAudioChecks) {
        const [isExpectedSpeaker, skipAudio] = await validAudioChecks();
        validSpeaker = isExpectedSpeaker;
        if (skipAudio) return false;
      }

      if (!validSpeaker || !text) {
        this.logger.debug(`STT: cannot detect text from audio clip.`);
        await this.continueAgentSpeech(payload.appId, payload.sessionId);
        await this.asyncApi.dialogueProgress({
          event: 'stt',
          sessionId: payload.sessionId,
          appId: payload.appId,
          status: 'ended',
        });
        return false;
      }

      if (!this.isRequestOngoing(payload)) {
        return false;
      }

      // this.dataset.saveRecord('stt', text, buffer, clientId, 'wav');

      text
        .split('\n')
        .forEach((part) =>
          this.logger.debug(`USER ${payload.requestId} | ${part}`),
        );

      const emotion = this.emotion.getUserEmotion(
        dialogueMessagePayload.sessionId,
      );

      const sttEvent: DialogueMessageDto = {
        ...dialogueMessagePayload,
        actor: 'user',
        emotion,
        text,
      };

      await this.broker.publish(SermasTopics.dialogue.stt, sttEvent);

      this.emitter.emit('dialogue.chat.message', sttEvent);
      return true;
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
    return false;
  }

  async onChatProgress(ev: DialogueChatProgressEvent) {
    if (ev.requestId) return;
    this.logger.debug(
      `Chat generation progress completed=${ev.completed} requestId=${ev.requestId} sessionId=${ev.sessionId}`,
    );
    this.trackRequest(ev.completed ? 'ended' : 'processing', ev);
  }

  async handleMessage(ev: DialogueMessageDto): Promise<void> {
    if (!this.isRequestOngoing(ev)) {
      return;
    }

    // user message
    if (ev.actor === 'user') {
      try {
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
    await this.asyncApi.dialogueProgress({
      event: 'translate',
      sessionId: ev.sessionId,
      appId: ev.appId,
    });

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

    // store agent audio embeddings
    await this.identiyTracker.agentSpeech(agentResponseEvent.sessionId, buffer);

    return buffer;
  }

  async sendAgentSpeech(message: DialogueMessageDto) {
    if (!this.isRequestOngoing(message)) {
      return;
    }

    message.ts = message.ts ? new Date(message.ts) : new Date();

    message.chunkId = message.chunkId || getChunkId(message.ts);
    message.messageId = message.messageId || getMessageId(message.ts);

    if (message.text) {
      message.text
        .split('\n')
        .forEach((t) => this.logger.verbose(`TTS | ${t}`));
    }

    if (message.text) {
      await this.asyncApi.dialogueProgress({
        event: 'tts',
        sessionId: message.sessionId,
        appId: message.appId,
      });
    }

    const promise = this.processAgentSpeech(message)
      .then((data) => Promise.resolve({ data, message }))
      .catch(() => Promise.resolve({ data: null, message }));

    // track request processing completion
    this.trackRequest('processing', message);

    this.addToOutgoingQueue(message, promise);
  }

  async addToOutgoingQueue(
    dialogueMessage: DialogueMessageDto,
    loader: Promise<OutgoingQueueMessage>,
  ) {
    if (!dialogueMessage.requestId) {
      this.logger.debug(`Missing requestId, skipping TTS`);
      await this.asyncApi.dialogueProgress({
        event: 'tts',
        sessionId: dialogueMessage.sessionId,
        appId: dialogueMessage.appId,
        status: 'ended',
      });
      return;
    }

    // add to queue
    if (!this.outgoingMessageQueue[dialogueMessage.requestId]) {
      this.outgoingMessageQueue[dialogueMessage.requestId] = {
        chunks: {},
        sent: 0,
        total: 0,
        streaming: false,
      };
    }

    this.outgoingMessageQueue[dialogueMessage.requestId].total++;
    this.outgoingMessageQueue[dialogueMessage.requestId].chunks[
      dialogueMessage.chunkId
    ] = {
      dialogueMessage,
      loader,
    };

    await this.processOutgoingQueue(dialogueMessage.requestId);

    await this.asyncApi.dialogueProgress({
      event: 'tts',
      sessionId: dialogueMessage.sessionId,
      appId: dialogueMessage.appId,
      status: 'ended',
    });
  }

  async processOutgoingQueue(requestId: string) {
    if (this.outgoingMessageSemaphore.has(requestId)) return;

    const outgoingChunksQueue = this.outgoingMessageQueue[requestId];
    if (!outgoingChunksQueue) return;

    const chunkKeys = Object.keys(outgoingChunksQueue.chunks);
    if (!chunkKeys.length) return;

    const chunkId = chunkKeys[0];

    const { loader, dialogueMessage } = outgoingChunksQueue.chunks[chunkId];
    if (!this.isRequestOngoing(dialogueMessage)) return;

    this.outgoingMessageSemaphore.add(requestId);

    const { data, message } = await loader;

    try {
      try {
        if (data && data.length) {
          this.logger.debug(
            `sending TTS chunk chunkId=${message.chunkId} message=${message.text}`,
          );
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
      outgoingChunksQueue.sent++;
      delete this.outgoingMessageQueue[requestId].chunks[chunkId];

      if (outgoingChunksQueue.sent === outgoingChunksQueue.total) {
        this.logger.verbose(`TTS queue sent for requestId=${requestId}`);
        delete this.outgoingMessageQueue[requestId];

        this.trackRequest('ended', dialogueMessage);
      }

      this.outgoingMessageSemaphore.delete(requestId);
      this.processOutgoingQueue(requestId);
    }
  }

  // async isUserTalkingToAvatar(
  //   params: CheckIfUserTalkingToAvatarPromptParam,
  //   sessionContext?: SessionContext,
  // ) {
  //   const res = await this.llmProvider.chat<UserMessageCheck>({
  //     stream: false,
  //     json: true,
  //     user: checkIfUserTalkingToAvatarPrompt(params),
  //     tag: 'chat',
  //     sessionContext,
  //   });

  //   this.logger.debug(
  //     `User message ${params.user} skip=${res?.skip} repeat=${res?.repeat} question=${res?.question}`,
  //   );
  //   return res;
  // }

  async handleUserMessage(message: DialogueMessageDto) {
    // load emotion
    const emotion = this.emotion.getUserEmotion(message.sessionId);
    if (emotion) message.emotion = emotion;

    // generate answer
    await this.chatProvider.inference(message);
  }

  async continueAgentSpeech(appId: string, sessionId: string) {
    this.logger.debug(
      `Send avatar speech CONTINUE sessionId=${sessionId} (disabled)`,
    );
    // this.emitter.emit('dialogue.chat.continue', { appId, sessionId });
    // this.asyncApi.agentContinueSpeech({
    //   appId,
    //   sessionId,
    //   ts: new Date(),
    // });
  }

  async stopAgentSpeech(ev: DialogueAvatarSpeechControlDto) {
    this.logger.debug(`Send avatar speech STOP sessionId=${ev.sessionId}`);
    this.emitter.emit('dialogue.chat.stop', ev);
    this.asyncApi.agentStopSpeech(ev);
  }

  async readUiContent(payload: UIContentDto) {
    if (!payload.options?.ttsEnabled) return;

    const text = uiContentToText(payload, {
      format: 'tts',
      withOptions: true,
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
      gender,
      llm: settings.llm,
      ts: payload.ts || new Date(),
      language,

      clientId: payload.clientId,
      sessionId: payload.sessionId,
      requestId: payload.requestId,
      chunkId: payload.chunkId || getChunkId(payload.ts),
    };

    await this.sendAgentSpeech(dialogueMessagePayload);
  }

  listModels() {
    return this.llmProvider.listModels();
  }
}
