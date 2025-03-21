import { Mistral } from '@mistralai/mistralai';
import { ChatCompletionResponse } from '@mistralai/mistralai/models/components';
import {
  LLMCallResult,
  LLMMessage,
  LLMChatOptions,
  LLMProviderConfig,
} from 'libs/llm/providers/provider.dto';
import { ChatMessageStream } from 'libs/llm/stream/chat-message.stream';
import { ChatCompletionStream } from 'openai/lib/ChatCompletionStream';
import { LLMChatProvider } from '../chat.provider';

export class MistralChatProvider extends LLMChatProvider {
  private mistral: Mistral;

  constructor(protected config: LLMProviderConfig) {
    super(config);
  }

  private getApiClient() {
    if (!this.mistral) {
      this.mistral = new Mistral({
        apiKey: this.config.apiKey,
      });
    }
    return this.mistral;
  }

  getName(): string {
    return 'mistral';
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
    messages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMCallResult> {
    const isStream = options?.stream === true || false;

    const stream = new ChatMessageStream();

    const res = await this.getApiClient().chat.complete({
      model: this.config.model,
      messages,
      stream: isStream,
    });

    if (!isStream) {
      const response = res as ChatCompletionResponse;
      const content = response.choices[0].message.content;
      stream.add(content);
      stream.close();
      return {
        stream,
      };
    }

    const openaiStream = res as unknown as ChatCompletionStream;

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
