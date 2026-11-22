import { Injectable, Logger } from '@nestjs/common';
import { AppToolsDTO } from '#apps/platform/src/app/platform.app.dto';
import { createSessionContext } from '#apps/session/src/session.context';
import { SessionService } from '#apps/session/src/session.service';
import { DialogueMessageDto } from '#libs/language/dialogue.message.dto';
import { LLMProviderService } from '#libs/llm/llm.provider.service';
import { getChunkId, getMessageId } from '#libs/sermas/sermas.utils';
import { ulid } from 'ulidx';
import { describeToolContent, packAvatarObject } from '../chat/utils.js';
import { DialogueSpeechService } from '../dialogue.speech.service.js';
import { toolContentPrompt } from './dialogue.tool-content.prompt.js';

// spoken when the LLM fails; English, translated downstream
const FALLBACK: Record<string, string> = {
  link: 'Here it is: scan the QR code on the screen to open it on your phone.',
  default: 'Here it is, on the screen.',
};

/** the content's own words, for the prompt: never more than what the app wrote */
const describe = (tool: AppToolsDTO): string =>
  describeToolContent(tool.ui as any) || '';

/**
 * A tool started from a button (not by the LLM) shows its UI content without a word:
 * this speaks one short line about what was shown, as an agent message.
 */
@Injectable()
export class DialogueToolContentService {
  private readonly logger = new Logger(DialogueToolContentService.name);

  constructor(
    private readonly speech: DialogueSpeechService,
    private readonly session: SessionService,
    private readonly llmProvider: LLMProviderService,
  ) {}

  /** whether a tool's content deserves a line: it shows something and does not opt out */
  wants(tool?: AppToolsDTO): boolean {
    return !!tool?.ui?.contentType && tool.skipResponse !== true;
  }

  async present(
    ev: { appId: string; sessionId: string },
    tool: AppToolsDTO,
    choice: string,
  ) {
    if (!this.wants(tool)) return;
    try {
      await this.say(ev, tool, choice);
    } catch (e: any) {
      this.logger.warn(`[${tool.name}] content line failed: ${e.message}`);
    }
  }

  private async say(
    ev: { appId: string; sessionId: string },
    tool: AppToolsDTO,
    choice: string,
  ) {
    const contentType = tool.ui.contentType;
    const language = await this.session.getLanguage(ev);
    const settings = await this.session.getSettings(ev);
    const avatar = await this.session.getAvatar(ev);

    let text = FALLBACK[contentType] || FALLBACK.default;
    let textLanguage = 'en-GB';
    try {
      const llm = await this.session.getLLM(ev.sessionId);
      const res = await this.llmProvider.chat<{ message: string }>({
        ...this.llmProvider.extractProviderName(llm?.chat),
        // as the user turn: some servers (vLLM) refuse a request with no user message
        user: toolContentPrompt({
          language,
          choice: choice || tool.description,
          tool: tool.description,
          contentType,
          content: describe(tool) || contentType,
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
      this.logger.debug(
        `[${tool.name}] content line from the LLM failed: ${e.message}`,
      );
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
