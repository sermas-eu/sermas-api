import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SessionDto } from 'apps/session/src/session.dto';
import { SessionService } from 'apps/session/src/session.service';
import { DefaultLanguage } from 'libs/language/lang-codes';
import { DialogueSpeechToTextDto } from 'libs/stt/stt.dto';
import { ulid } from 'ulidx';
import { DialogueSpeechService } from '../dialogue.speech.service';
import { convertRawPCMToWav } from './convert-wav';

const MESSAGE_FRAME_CLEANUP_MS = 20 * 1000;

type SpeechStreamMessage = Buffer;

type SessionMessageDto = {
  session: SessionDto;
  chunkId: string;
  buffer: Buffer;
};

type CompletionMessageDto = {
  isSpeech: boolean;
};

@Injectable()
export class DialogueSpeechStreamService {
  private readonly logger = new Logger(DialogueSpeechStreamService.name);

  // private readonly cache: Record<string, Record<string, SpeechStreamMessage>> =
  //   {};

  constructor(
    private session: SessionService,
    private speech: DialogueSpeechService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  parseJSON<T = any>(buffer: Buffer) {
    try {
      return JSON.parse((buffer || '').toString()) as T;
    } catch {}
    return null;
  }

  async getSessionFromTopic(topic: string) {
    const parts = topic.split('/');
    const chunkId = parts.pop();
    const sessionId = parts.pop();

    if (!sessionId) return null;

    const session = await this.session.read(sessionId, false);
    if (!session) {
      this.logger.verbose(`skip frames sessionId=${sessionId} not found`);
      return null;
    }

    return { session, sessionId, chunkId };
  }

  getCacheId(ev: { sessionId: string; chunkId: string }) {
    return `frames_${ev.sessionId}_${ev.chunkId}`;
  }

  async processStreamFrame(topic: string, buffer: Buffer) {
    const context = await this.getSessionFromTopic(topic);
    if (context === null) return;

    const { sessionId, chunkId, session } = context;

    const cacheId = this.getCacheId({ sessionId, chunkId });

    let sessionMessage =
      await this.cacheManager.get<SpeechStreamMessage>(cacheId);

    if (!sessionMessage) {
      sessionMessage = Buffer.from([]);
    }

    const completion = this.parseJSON<CompletionMessageDto>(buffer);

    // cache raw frames
    if (!completion) {
      try {
        sessionMessage = Buffer.concat([Buffer.from(sessionMessage), buffer]);
        await this.cacheManager.set(
          cacheId,
          sessionMessage,
          MESSAGE_FRAME_CLEANUP_MS,
        );
        const size = sessionMessage.length / 1000;
        this.logger.verbose(
          `Cached frame len=${buffer.length} total=${size}kb chunkId=${chunkId} sessionId=${sessionId}`,
        );
      } catch (e) {
        this.logger.warn(`Failed to cache frame ${e.message}`);
        this.logger.debug(e.stack);
      }
      return;
    }

    if (!completion.isSpeech) {
      this.logger.verbose(
        `Not speech, release cache chunkId=${chunkId} sessionId=${sessionId}`,
      );
      this.releaseCache(sessionId, chunkId);
      return;
    }

    // message is completed, pass to STT
    try {
      this.logger.verbose(
        `Processing frames size=${sessionMessage.length * 1024} chunkId=${chunkId} sessionId=${sessionId}`,
      );

      const buffer = convertRawPCMToWav(sessionMessage, 16000);

      this.logger.verbose(`WAV has len=${buffer.length}`);

      await this.processMessage({
        chunkId: chunkId,
        session: session,
        buffer,
      });
    } finally {
      this.releaseCache(sessionId, chunkId);
    }
  }

  async releaseCache(sessionId: string, chunkId: string) {
    try {
      await this.cacheManager.del(this.getCacheId({ sessionId, chunkId }));
    } catch {}
  }

  async processChunk(topic: string, buffer: Buffer) {
    const context = await this.getSessionFromTopic(topic);
    if (context === null) return;

    const { chunkId, session } = context;

    await this.processMessage({
      buffer,
      chunkId,
      session,
    });
  }

  async processMessage(sessionMessage: SessionMessageDto) {
    const { chunkId, session, buffer } = sessionMessage;
    const sessionId = session.sessionId;

    try {
      const settings = session.settings || {};
      const ev: DialogueSpeechToTextDto = {
        appId: session.appId,
        sessionId,
        requestId: ulid(),
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

      this.logger.debug(
        `Got user speech chunkId=${chunkId} sessionId=${sessionId}`,
      );
      await this.speech.speechToText(ev);
    } catch (e) {
      this.logger.error(
        `Failed to process user audio for chunkId=${chunkId}: ${e.stack}`,
      );
    }
  }
}
