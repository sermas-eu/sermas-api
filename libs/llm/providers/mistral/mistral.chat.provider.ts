import { Mistral } from '@mistralai/mistralai';
import {
  ChatCompletionResponse,
  ContentChunk,
} from '@mistralai/mistralai/models/components';
import {
  LLMCallResult,
  LLMChatOptions,
  LLMMessage,
  LLMProviderConfig,
} from 'libs/llm/providers/provider.dto';
import { ChatMessageStream } from 'libs/llm/stream/chat-message.stream';
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
    if (!isStream) {
      const res = await this.getApiClient().chat.complete({
        model: this.config.model,
        messages,
        topP: this.config.top_p,
        temperature: this.config.temperature,
      });

      const response = res as ChatCompletionResponse;
      let chunk = response.choices[0].message.content;
      if (typeof chunk !== 'string') {
        const contentChunk = (chunk as any[]).at(0) as ContentChunk;
        chunk = (contentChunk as any).text as string;
      }
      if (chunk !== null) {
        stream.add(chunk);
      }
      stream.close();
      return {
        stream,
      };
    }

    const openaiStream = await this.getApiClient().chat.stream({
      model: this.config.model,
      messages,
      stream: isStream,
      topP: this.config.top_p,
      temperature: this.config.temperature,
    });

    let aborted = false;
    (async () => {
      for await (const completionChunk of openaiStream) {
        if (aborted) break;
        let chunk = completionChunk.data.choices[0].delta.content;
        if (typeof chunk !== 'string') {
          const contentChunk = (chunk as any[]).at(0) as ContentChunk;
          chunk = (contentChunk as any).text as string;
        }
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
