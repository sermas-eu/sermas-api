import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createSessionContext } from 'apps/session/src/session.context';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { Model } from 'mongoose';
import { DialogueMemoryMessageDto } from './dialogue.memory.dto';
import { DialogueMemory } from './dialogue.memory.schema';

@Injectable()
export class DialogueMemoryService implements OnModuleInit {
  private readonly logger = new Logger(DialogueMemoryService.name);

  constructor(
    @InjectModel(DialogueMemory.name)
    private readonly memory: Model<DialogueMemory>,
    private readonly llmProvider: LLMProviderService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  onModuleInit() {
    //
  }

  async getSummary(sessionId: string, force = false) {
    if (!force) {
      const cached = await this.cacheManager.get(`summary-${sessionId}`);
      if (cached) return cached as string;
    }

    const messages = await this.getMessages(sessionId);
    if (!messages.length) return '';

    // use history
    if (messages.length <= 3) return this.conversationToText(messages);

    const newerMessages = messages.splice(-3);
    const history = this.conversationToText(messages);

    try {
      let summary = await this.llmProvider.chat({
        user: `Summarize the following interaction between user and assistant in a few sentences. Be precise but coincise, do not add context.\n\n${history}`,
        stream: false,
        json: false,
        tag: 'chat',
        sessionContext: createSessionContext({ sessionId }),
      });

      summary += '\n' + this.conversationToText(newerMessages);

      await this.cacheManager.set(
        `summary-${sessionId}`,
        summary,
        5 * 60 * 1000,
      );
      return summary;
    } catch (e) {
      this.logger.error(`Error calling LLM: ${e.stack}`);
    }
    return '';
  }

  async getConversation(
    sessionId: string | { sessionId: string },
    limit?: number,
  ) {
    const history = await this.getMessages(
      typeof sessionId === 'string' ? sessionId : sessionId.sessionId,
      limit,
    );
    return this.conversationToText(history);
  }

  private conversationToText(history: DialogueMemoryMessageDto[]) {
    if (!history || !history.length) return;
    return history
      .filter((h) => h.type === 'message')
      .map((h) => `- ${h.role}: ${h.content}`)
      .join('\n');
  }

  async getMessages(sessionId: string, limit?: number) {
    const record = await this.memory.findOne({ sessionId });

    if (!record) return [];

    let messages = record.toObject().messages;
    if (limit && limit < messages.length) {
      messages = messages.slice(messages.length - limit);
    }

    return messages;
  }

  async addMessages(sessionId: string, messages: DialogueMemoryMessageDto[]) {
    let session = await this.memory.findOne({ sessionId });
    if (!session) {
      session = new this.memory({
        sessionId,
        messages: [],
      });
    }
    messages = messages || [];
    session.messages = session.messages || [];

    if (session.messages.length && messages.length) {
      for (const message of messages) {
        // if last message has same role of current message, append content
        const lastMessage = session.messages[session.messages.length - 1];

        lastMessage.type = lastMessage.type || 'message';
        message.type = message.type || 'message';

        if (
          lastMessage.role === message.role &&
          message.type === 'message' &&
          message.type === lastMessage.type
        ) {
          lastMessage.content += message.role === 'user' ? '\n' : ' ';
          lastMessage.content += message.content;
          lastMessage.ts = message.ts || new Date();
          session.messages[session.messages.length - 1] = lastMessage;
          continue;
        }
        session.messages.push(message);
      }
    } else {
      session.messages.push(
        ...messages.map((m) => ({
          ...m,
          ts: m.ts || new Date(),
        })),
      );
    }

    await session.save();

    // regenerate cache
    if (
      session.messages[session.messages.length - 1] &&
      session.messages[session.messages.length - 1].role === 'assistant'
    ) {
      await this.getSummary(sessionId, true);
    }
  }

  async clear(sessionId: string) {
    await this.memory.deleteOne({ sessionId });
  }
}
