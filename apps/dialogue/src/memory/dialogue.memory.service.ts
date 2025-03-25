import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DialogueMemoryMessageDto } from './dialogue.memory.dto';
import { DialogueMemory } from './dialogue.memory.schema';
import { DialogueMemorySummaryService } from './dialogue.memory.summary.service';
import { conversationToText } from './util';

@Injectable()
export class DialogueMemoryService implements OnModuleInit {
  private readonly logger = new Logger(DialogueMemoryService.name);

  constructor(
    @InjectModel(DialogueMemory.name)
    private readonly memory: Model<DialogueMemory>,
    private readonly summary: DialogueMemorySummaryService,
  ) {}

  onModuleInit() {
    //
  }

  async getConversation(
    sessionId: string | { sessionId: string },
    limit?: number,
  ) {
    const history = await this.getMessages(
      typeof sessionId === 'string' ? sessionId : sessionId.sessionId,
      limit,
    );
    return conversationToText(history);
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
    await this.summary.generateSummary(sessionId);
  }

  getSummary(sessionId: string) {
    return this.summary.getSummary(sessionId);
  }

  async clear(sessionId: string) {
    await this.memory.deleteOne({ sessionId });
  }
}
