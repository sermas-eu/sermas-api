import {
  LLMCallResult,
  LLMChatOptions,
  LLMMessage,
  LLMProviderConfig,
} from '../provider.dto';
import { LLMChatProvider } from '../chat.provider';
import { ChatMessageStream } from 'libs/llm/stream/chat-message.stream';
import { MistralGoogleCloud } from '@mistralai/mistralai-gcp';
import { ContentChunk } from '@mistralai/mistralai/models/components';

export class VertexAIChatProvider extends LLMChatProvider {
  private vertexai: MistralGoogleCloud;

  constructor(protected config: LLMProviderConfig) {
    super(config);
  }

  private getApiClient(): MistralGoogleCloud {
    if (!this.vertexai) {
      // TODO: Refactor
      const project = 'sermas-ga-nr-101070351';
      const location = 'europe-west4';
      this.vertexai = new MistralGoogleCloud({
        projectId: project,
        region: location,
      });
    }
    return this.vertexai;
  }

  getName(): string {
    return 'vertexai';
  }

  available(): Promise<boolean> {
    // TODO...
    return new Promise<boolean>(() => true);
  }

  public async getModels() {
    // TODO: There seems to be no way to list available model using the SDK...
    return this.config.availableModels || [];
  }

  async call(
    messages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMCallResult> {
    const isStream = options?.stream === true || false;
    const stream = new ChatMessageStream();
    const request = {
      model: this.config.model,
      messages: [...messages],
    };

    if (!isStream) {
      const response = await this.getApiClient().chat.complete(request);
      const content = response.choices.at(0)?.message.content as string; // TODO: Check type
      stream.add(content);
      stream.close();
      return {
        stream,
      };
    }

    let aborted = false;
    const result = await this.getApiClient().chat.stream(request);
    (async () => {
      for await (const event of result) {
        if (aborted) break;
        let chunk = event.data.choices.at(0)?.delta.content; // TODO: Check type
        if (typeof chunk !== 'string') {
          const contentChunk = chunk.at(0) as ContentChunk;
          chunk = contentChunk.text;
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
