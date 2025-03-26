import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createSessionContext } from 'apps/session/src/session.context';
import { sleep } from 'crawlee';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { Model } from 'mongoose';
import { ulid } from 'ulidx';
import { DialogueMemory } from './dialogue.memory.schema';
import { conversationToText } from './util';

// number of recent messages to return in the history
const MAX_RAW_HISTORY = 3;

// min number of messages to summarize, excluded those in MAX_RAW_HISTORY
const MIN_SUMMARIZE_MESSAGES = 2;

type CachedSummary = {
  cacheId: string;
  lastIndex: number;
  ts: Date;
  summary: string;
};

type CacheQueue = {
  cacheId: string;
  ts: Date;
  cancelled: boolean;
};

@Injectable()
export class DialogueMemorySummaryService {
  private readonly logger = new Logger(DialogueMemorySummaryService.name);

  private queue: Record<string, CacheQueue[]> = {};

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

  getQueue(sessionId: string) {
    this.queue[sessionId] = this.queue[sessionId] || [];
    return this.queue[sessionId];
  }

  getQueueItem(sessionId: string, cacheId: string) {
    const queue = this.getQueue(sessionId);
    const items = queue.filter((q) => q.cacheId === cacheId);
    return items.length ? items.at(0) : null;
  }

  queueIsCancelled(sessionId: string, cacheId: string) {
    const item = this.getQueueItem(sessionId, cacheId);
    if (!item) return false;
    return item.cancelled;
  }

  clearQueue() {
    for (const sessionId in this.queue) {
      this.queue[sessionId] = this.queue[sessionId].filter(
        (q) => !q.cancelled && q.ts.getTime() > Date.now() - 5 * 60 * 1000,
      );
      if (this.queue[sessionId].length === 0) {
        delete this.queue[sessionId];
      }
    }
  }

  async generateSummary(sessionId: string) {
    const messages = await this.loadMessages(sessionId);
    if (!messages.length) return;

    this.queue[sessionId] = this.queue[sessionId] || [];

    const cacheId = ulid();
    this.queue[sessionId].push({
      cacheId,
      ts: new Date(),
      cancelled: false,
    });

    // generate only after user message
    if (
      messages[messages.length - 1] &&
      messages[messages.length - 1].role === 'assistant'
    ) {
      // wait for upcoming messages
      await sleep(1500);
    }

    // use raw messages
    if (messages.length <= MAX_RAW_HISTORY) return;

    const olderMessages = messages.slice(0, -1 * MAX_RAW_HISTORY);
    if (olderMessages.length < MIN_SUMMARIZE_MESSAGES) return;

    // cancel previous ongoing summarization
    this.getQueue(sessionId)
      .filter((q) => q.cacheId < cacheId)
      .filter((q) => q.cacheId !== cacheId)
      .forEach((q) => (q.cancelled = true));

    const history = conversationToText(olderMessages, true);

    if (this.queueIsCancelled(sessionId, cacheId)) {
      this.logger.debug(
        `Summary queue cancelled cacheId=${cacheId} sessionId=${sessionId}`,
      );
      return;
    }

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
        cacheId,
        lastIndex: olderMessages.length - 1,
        ts: new Date(),
        summary,
      };

      if (this.queueIsCancelled(sessionId, cacheId)) {
        this.logger.debug(
          `Summary queue cancelled cacheId=${cacheId} sessionId=${sessionId}`,
        );
        return;
      }

      await this.cacheManager.set(
        `summary-${sessionId}`,
        cachedSummary,
        5 * 60 * 1000,
      );
    } catch (e) {
      this.logger.error(`Error summarizing: ${e.stack}`);
    } finally {
      this.clearQueue();
    }
  }
}
