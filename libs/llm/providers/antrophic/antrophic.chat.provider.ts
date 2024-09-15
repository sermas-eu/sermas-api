import Anthropic from '@anthropic-ai/sdk';
import { Stream } from '@anthropic-ai/sdk/streaming';
import {
  LLMCallResult,
  LLMMessage,
  LLMChatOptions,
  LLMProviderConfig,
} from 'libs/llm/providers/provider.dto';
import { ChatMessageStream } from 'libs/llm/stream/chat-message.stream';
import { LLMChatProvider } from '../chat.provider';

export class AntrophicChatProvider extends LLMChatProvider {
  private readonly client: Anthropic;

  constructor(protected config: LLMProviderConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  getName(): string {
    return 'antrophic';
  }

  async available(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    return true;
  }

  public async getModels() {
    if (this.models === undefined) {
      // const models = await this.client.
      // this.models = models.data.map((model) => model.id);
    }
    return this.models;
  }

  async call(
    chatMessages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMCallResult> {
    const isStream = options?.stream === true || false;

    const messages: Anthropic.MessageParam[] = [];

    for (const msg of chatMessages) {
      const message: Anthropic.MessageParam = {
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      };
      messages.push(message);
    }

    const stream = new ChatMessageStream();

    const res = await this.client.messages.create({
      max_tokens: 1024,
      messages: messages,
      model: this.config.model,
      stream: isStream,
    });

    if (!isStream) {
      const response = res as Anthropic.Messages.Message;
      response.content
        .filter((r) => r.type === 'text')
        .forEach((r) => stream.add(r.text));
      stream.close();
      return {
        stream,
      };
    }

    const responseStream = res as Stream<Anthropic.Messages.MessageStreamEvent>;

    let aborted = false;
    (async () => {
      for await (const event of responseStream) {
        if (aborted) break;

        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          stream.add(event.delta.text);
        }
      }

      stream.close();
    })();

    return {
      stream,
      abort: () => (aborted = true),
    };
  }
}
