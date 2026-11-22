import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createSessionContext } from '#apps/session/src/session.context';
import { SessionService } from '#apps/session/src/session.service';
import { DialogueMessageDto } from '#libs/language/dialogue.message.dto';
import { LLMProviderService } from '#libs/llm/llm.provider.service';
import { getChunkId, getMessageId } from '#libs/sermas/sermas.utils';
import { ulid } from 'ulidx';
import { packAvatarObject } from '../chat/utils.js';
import { DialogueSpeechService } from '../dialogue.speech.service.js';
import { ToolTriggerEventDto } from '../tools/trigger/dialogue.tools.trigger.dto.js';
import { extractToolValues } from '../tools/utils.js';
import { quizCommentPrompt } from './dialogue.quiz.prompt.js';

/**
 * A quiz answer clicked in the UI: the LLM comments on it (right or wrong, and why),
 * spoken as an agent message. The answer's UI tool carries the question, `correct`
 * and `reason` (DialogueToolsEventsService.addToolsContent).
 */
@Injectable()
export class DialogueQuizService {
  private readonly logger = new Logger(DialogueQuizService.name);

  constructor(
    private readonly speech: DialogueSpeechService,
    private readonly session: SessionService,
    private readonly llmProvider: LLMProviderService,
  ) {}

  @OnEvent('dialogue.tool.trigger')
  async onQuizAnswer(ev: ToolTriggerEventDto) {
    if (ev?.source !== 'ui' || !ev.sessionId) return;
    const values = extractToolValues(ev.schema);
    if (!values.answerId || typeof values.correct !== 'boolean') return;
    try {
      await this.comment(ev, {
        question: `${values.question || ''}`,
        answer: `${values.selection || ''}`,
        correct: values.correct,
        reason: `${values.reason || ''}`,
      });
    } catch (e: any) {
      this.logger.warn(`Quiz comment failed: ${e.message}`);
    }
  }

  private async comment(
    ev: ToolTriggerEventDto,
    quiz: {
      question: string;
      answer: string;
      correct: boolean;
      reason: string;
    },
  ) {
    const language = await this.session.getLanguage(ev);
    const settings = await this.session.getSettings(ev);
    const avatar = await this.session.getAvatar(ev);

    // fallback: the reason as written in the app, translated downstream
    let text = quiz.reason;
    let textLanguage = settings?.language || 'en-GB';
    try {
      const llm = await this.session.getLLM(ev.sessionId);
      const res = await this.llmProvider.chat<{ message: string }>({
        ...this.llmProvider.extractProviderName(llm?.chat),
        // as the user turn: some servers (vLLM) refuse a request with no user message
        user: quizCommentPrompt({
          ...quiz,
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
      this.logger.debug(`Quiz comment from the LLM failed: ${e.message}`);
    }

    if (!text) return;

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
