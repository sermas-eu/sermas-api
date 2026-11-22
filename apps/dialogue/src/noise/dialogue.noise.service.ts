import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { createSessionContext } from '#apps/session/src/session.context';
import { SessionChangedDto } from '#apps/session/src/session.dto';
import { SessionService } from '#apps/session/src/session.service';
import { DialogueMessageDto } from '#libs/language/dialogue.message.dto';
import { LLMProviderService } from '#libs/llm/llm.provider.service';
import { getChunkId, getMessageId } from '#libs/sermas/sermas.utils';
import { ulid } from 'ulidx';
import { DialogueChatValidationEvent } from '../chat/dialogue.chat.dto.js';
import { packAvatarObject } from '../chat/utils.js';
import { DialogueAsyncApiService } from '../dialogue.async.service.js';
import { DialogueSpeechService } from '../dialogue.speech.service.js';
import { noisyRoomPrompt } from './dialogue.noise.prompt.js';
import { TurnDropReason, TurnFailureTracker } from './turn-failure.tracker.js';

export type DialogueTurnDroppedEvent = {
  appId: string;
  sessionId: string;
  reason: TurnDropReason;
};

const FALLBACK_MESSAGE =
  "It's hard to hear you right now. You can type your message with the keyboard instead.";

const num = (value: unknown, fallback: number) => {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n)
    ? n
    : fallback;
};

/**
 * Turns a run of dropped voice turns into one spoken suggestion to type, and a
 * `noisy` progress event the client uses to open its keyboard.
 */
@Injectable()
export class DialogueNoiseService {
  private readonly logger = new Logger(DialogueNoiseService.name);
  readonly tracker: TurnFailureTracker;
  private readonly enabled: boolean;

  constructor(
    config: ConfigService,
    private readonly speech: DialogueSpeechService,
    private readonly session: SessionService,
    private readonly llmProvider: LLMProviderService,
    private readonly asyncApi: DialogueAsyncApiService,
  ) {
    // 0 disables the suggestion
    const threshold = num(config.get('DIALOGUE_NOISY_THRESHOLD'), 3);
    this.enabled = threshold > 0;
    this.tracker = new TurnFailureTracker({
      threshold,
      windowMs: num(config.get('DIALOGUE_NOISY_WINDOW_SEC'), 60) * 1000,
      cooldownMs: num(config.get('DIALOGUE_NOISY_COOLDOWN_SEC'), 120) * 1000,
    });
  }

  @OnEvent('dialogue.turn.dropped')
  async onTurnDropped(ev: DialogueTurnDroppedEvent) {
    if (!ev?.sessionId || !this.enabled) return;
    if (!this.tracker.drop(ev.sessionId)) return;
    this.logger.debug(
      `Noisy room: suggesting the keyboard sessionId=${ev.sessionId} last=${ev.reason}`,
    );
    try {
      await this.suggestKeyboard(ev);
    } catch (e: any) {
      this.logger.warn(`Failed to suggest the keyboard: ${e.message}`);
    }
  }

  @OnEvent('dialogue.chat.validation')
  onValidation(ev: DialogueChatValidationEvent) {
    if (!ev?.sessionId) return;
    if (ev.skip) {
      // chatter or a fragment the LLM filter ignored: a dropped turn too
      return this.onTurnDropped({
        appId: ev.appId,
        sessionId: ev.sessionId,
        reason: 'skipped',
      });
    }
    this.tracker.answered(ev.sessionId);
  }

  @OnEvent('session.changed')
  onSessionChanged(ev: SessionChangedDto) {
    if (ev?.operation === 'updated' && ev.record?.closedAt) {
      this.tracker.clear(ev.record.sessionId);
    }
  }

  private async suggestKeyboard(ev: DialogueTurnDroppedEvent) {
    // the client opens its keyboard on this, before the spoken line arrives
    await this.asyncApi.dialogueProgress({
      event: 'stt',
      status: 'error',
      error: 'noisy',
      appId: ev.appId,
      sessionId: ev.sessionId,
    });

    const language = await this.session.getLanguage(ev);
    const settings = await this.session.getSettings(ev);
    const avatar = await this.session.getAvatar(ev);

    let text = FALLBACK_MESSAGE;
    let textLanguage = 'en-GB';
    try {
      const llm = await this.session.getLLM(ev.sessionId);
      const res = await this.llmProvider.chat<{ message: string }>({
        ...this.llmProvider.extractProviderName(llm?.chat),
        // as the user turn: some servers (vLLM) refuse a request with no user message
        user: noisyRoomPrompt({
          language,
          app: settings?.prompt?.text,
          avatar: avatar ? packAvatarObject(avatar) : undefined,
        }),
        stream: false,
        json: true,
        tag: 'chat',
        sessionContext: createSessionContext(ev),
      });
      if (typeof res?.message === 'string' && res.message.trim()) {
        text = res.message.trim();
        textLanguage = language;
      }
    } catch (e: any) {
      this.logger.debug(`Noisy-room line from the LLM failed: ${e.message}`);
    }

    const msg: DialogueMessageDto = {
      actor: 'agent',
      appId: ev.appId,
      sessionId: ev.sessionId,
      language: textLanguage,
      gender: avatar?.gender,
      text,
      ts: new Date(),
      messageId: getMessageId(),
      chunkId: getChunkId(),
      requestId: ulid(),
    };
    await this.speech.chat(msg);
  }
}
