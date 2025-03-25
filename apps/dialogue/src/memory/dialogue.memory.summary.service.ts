import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createSessionContext } from 'apps/session/src/session.context';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { Model } from 'mongoose';
import { DialogueMemory } from './dialogue.memory.schema';
import { conversationToText } from './util';

// number of recent messages to return in the history
const MAX_RAW_HISTORY = 3;

// min number of messages to summarize, excluded those in MAX_RAW_HISTORY
const MIN_SUMMARIZE_MESSAGES = 2;

type CachedSummary = {
  lastIndex: number;
  ts: Date;
  summary: string;
};

@Injectable()
export class DialogueMemorySummaryService {
  private readonly logger = new Logger(DialogueMemorySummaryService.name);

  constructor(
    @InjectModel(DialogueMemory.name)
    private readonly memory: Model<DialogueMemory>,
    private readonly llmProvider: LLMProviderService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getSummary(sessionId: string) {
    const cached = await this.cacheManager.get<CachedSummary>(
      `summary-${sessionId}`,
    );

    let messages = await this.loadMessages(sessionId);

    if (cached && cached.summary) {
      let newMessages = messages.filter((m, i) => i > cached.lastIndex);
      if (newMessages.length > MAX_RAW_HISTORY) {
        newMessages = newMessages.slice(-1 * MAX_RAW_HISTORY);
      }

      return `${cached.summary}\n${conversationToText(newMessages, true)}`;
    }

    this.generateSummary(sessionId);

    // cut-off longer history
    if (messages.length > MAX_RAW_HISTORY) {
      messages = messages.slice(-1 * MAX_RAW_HISTORY);
    }
    return conversationToText(messages, true);
  }

  async loadMessages(sessionId: string) {
    const record = await this.memory.findOne({ sessionId });
    if (!record) return [];
    const messages = record.messages || [];
    return messages;
  }

  async generateSummary(sessionId: string) {
    const messages = await this.loadMessages(sessionId);
    if (!messages.length) return;

    // generate only after user message
    // if (
    //   messages[messages.length - 1] &&
    //   messages[messages.length - 1].role === 'assistant'
    // ) {
    //   return;
    // }

    // use raw messages
    if (messages.length <= MAX_RAW_HISTORY) return;

    const olderMessages = messages.slice(0, -1 * MAX_RAW_HISTORY);
    if (olderMessages.length < MIN_SUMMARIZE_MESSAGES) return;

    const history = conversationToText(olderMessages, true);

    try {
      const summary = await this.llmProvider.chat({
        user: `
Summarize the following interaction between user and assistant (agent) in a few sentences, use english language. Be precise but coincise. 
Do not add notes or explanation.

${history}`,
        stream: false,
        json: false,
        tag: 'chat',
        sessionContext: createSessionContext({ sessionId }),
      });

      const cachedSummary: CachedSummary = {
        lastIndex: olderMessages.length - 1,
        ts: new Date(),
        summary,
      };

      await this.cacheManager.set(
        `summary-${sessionId}`,
        cachedSummary,
        5 * 60 * 1000,
      );
    } catch (e) {
      this.logger.error(`Error summarizing: ${e.stack}`);
    }
  }
}
