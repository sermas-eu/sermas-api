import {
  LLMCallResult,
  LLMMessage,
  LLMChatOptions,
  LLMProviderConfig,
} from 'libs/llm/providers/provider.dto';
import { ChatMessageStream } from 'libs/llm/stream/chat-message.stream';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { Stream } from 'openai/streaming';
import { LLMChatProvider } from '../chat.provider';
import { createClient } from './util';

export class OpenAIChatProvider extends LLMChatProvider {
  private openai: OpenAI;

  constructor(protected config: LLMProviderConfig) {
    super(config);
  }

  private getApiClient() {
    if (!this.openai) {
      this.openai = createClient(this.config);
    }
    return this.openai;
  }

  getName(): string {
    return 'openai';
  }

  async available(): Promise<boolean> {
    if (!this.config.apiKey) return false;

    return true;
  }

  public async getModels() {
    if (this.models === undefined) {
      const models = await this.getApiClient().models.list();
      this.models = models.data.map((model) => model.id);
    }
    return this.models;
  }

  async call(
    chatMessages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMCallResult> {
    const isStream = options?.stream === true || false;

    const messages: ChatCompletionMessageParam[] = [];

    for (const msg of chatMessages) {
      // TODO handle function
      const message: ChatCompletionMessageParam = {
        role: msg.role,
        content: msg.content,
      };
      messages.push(message);
    }

    const stream = new ChatMessageStream();

    const res = await this.getApiClient().chat.completions.create({
      model: this.config.model,
      messages,
      stream: isStream,
      top_p: this.config.top_p,
      temperature: this.config.temperature,
    });

    if (!isStream) {
      const response = res as OpenAI.Chat.Completions.ChatCompletion;
      const content = response.choices[0].message.content;
      stream.add(content);
      stream.close();
      return {
        stream,
      };
    }

    const openaiStream =
      res as Stream<OpenAI.Chat.Completions.ChatCompletionChunk>;

    let aborted = false;
    (async () => {
      for await (const completionChunk of openaiStream) {
        if (aborted) break;
        const chunk = completionChunk.choices[0].delta.content;
        stream.add(chunk);
      }
      stream.close();
    })();

    return {
      stream,
      abort: () => (aborted = true),
    };
  }
}
