import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SessionDto } from 'apps/session/src/session.dto';
import { SessionService } from 'apps/session/src/session.service';
import { DefaultLanguage } from 'libs/language/lang-codes';
import { DialogueSpeechToTextDto } from 'libs/stt/stt.dto';
import { ulid } from 'ulidx';
import { DialogueSpeechService } from '../dialogue.speech.service';
import { convertRawPCMToWav } from './convert-wav';

const MESSAGE_FRAME_CLEANUP_MS = 15 * 1000;

type SpeechStreamMessage = {
  session: SessionDto;
  chunkId: string;
  frames: Buffer[];
  created: Date;
};

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

  private readonly cache: Record<string, Record<string, SpeechStreamMessage>> =
    {};

  constructor(
    private session: SessionService,
    private speech: DialogueSpeechService,
  ) {}

  @Interval(MESSAGE_FRAME_CLEANUP_MS / 2)
  cleanup() {
    for (const sessionId in this.cache) {
      for (const chunkId in this.cache[sessionId]) {
        const streamMessage = this.cache[sessionId][chunkId];

        if (
          Date.now() - streamMessage.created.getTime() >
          MESSAGE_FRAME_CLEANUP_MS
        ) {
          if (!this.cache[sessionId][chunkId]) return;

          this.logger.verbose(
            `Remove message frames buffer for chunkId=${streamMessage.chunkId} sessionId=${streamMessage.session.sessionId}`,
          );
          delete this.cache[sessionId][chunkId];
        }
      }
      // release sessions
      if (
        this.cache[sessionId] &&
        Object.keys(this.cache[sessionId]).length === 0
      ) {
        delete this.cache[sessionId];
      }
    }
  }

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
      this.logger.debug(`sessionId=${sessionId} not found`);
      return null;
    }

    return { session, sessionId, chunkId };
  }

  async processStreamFrame(topic: string, buffer: Buffer) {
    const context = await this.getSessionFromTopic(topic);
    if (context === null) return;

    const { sessionId, chunkId, session } = context;

    this.cache[sessionId] = this.cache[sessionId] || {};

    this.cache[sessionId][chunkId] = this.cache[sessionId][chunkId] || {
      created: new Date(),
      session,
      chunkId,
      frames: [],
    };

    const completion = this.parseJSON<CompletionMessageDto>(buffer);

    // cache raw frames
    if (!completion) {
      this.cache[sessionId][chunkId].frames.push(buffer);

      // const size = this.cache[sessionId][chunkId].frames.length / 1000;
      // this.logger.verbose(
      //   `Cached frame len=${buffer.length} total=${size}kb chunkId=${chunkId} sessionId=${sessionId}`,
      // );
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
    const sessionMessage = this.cache[sessionId][chunkId];
    try {
      this.logger.verbose(
        `Processing ${sessionMessage.frames.length} frames size=${sessionMessage.frames.reduce((size, frame) => size + frame.length, 0)} chunkId=${chunkId} sessionId=${sessionId}`,
      );

      const buffer = convertRawPCMToWav(
        Buffer.concat(sessionMessage.frames),
        16000,
      );

      this.logger.verbose(`WAV has len=${buffer.length}`);

      await this.processMessage({
        chunkId: sessionMessage.chunkId,
        session: sessionMessage.session,
        buffer,
      });
    } finally {
      this.releaseCache(sessionId, chunkId);
    }
  }

  releaseCache(sessionId: string, chunkId: string) {
    if (!this.cache[sessionId][chunkId]) return;
    delete this.cache[sessionId][chunkId];
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
