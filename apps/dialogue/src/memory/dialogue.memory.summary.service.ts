import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createSessionContext } from 'apps/session/src/session.context';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { Model } from 'mongoose';
import { DialogueMemory } from './dialogue.memory.schema';
import { conversationToText } from './util';

type CachedSummary = {
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
    if (cached && cached.summary) return cached.summary;

    this.generateSummary(sessionId);

    let messages = await this.loadMessages(sessionId);

    // cut-off longer history
    if (messages.length > 5) {
      messages = messages.slice(-5);
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
    if (
      messages[messages.length - 1] &&
      messages[messages.length - 1].role === 'assistant'
    ) {
      return;
    }

    // use history
    if (messages.length <= 3) return;

    const newerMessages = messages.splice(-3);
    const history = conversationToText(messages, true);

    try {
      let summary = await this.llmProvider.chat({
        user: `
        Summarize the following interaction between user and assistant (agent) in a few sentences, use english language. 
        Be precise but coincise. Do not add notes or explanation.
        
        ${history}`,
        stream: false,
        json: false,
        tag: 'chat',
        sessionContext: createSessionContext({ sessionId }),
      });

      summary += '\n' + conversationToText(newerMessages, true);

      const cachedSummary: CachedSummary = {
        ts: new Date(),
        summary,
      };

      this.cacheManager.set(
        `summary-${sessionId}`,
        cachedSummary,
        5 * 60 * 1000,
      );
    } catch (e) {
      this.logger.error(`Error summarizing: ${e.stack}`);
    }
  }
}
