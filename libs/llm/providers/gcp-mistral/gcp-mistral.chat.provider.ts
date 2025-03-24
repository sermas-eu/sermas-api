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

export class GCPMistralChatProvider extends LLMChatProvider {
  private mistral: MistralGoogleCloud;

  constructor(protected config: LLMProviderConfig) {
    super(config);
  }

  private getApiClient(): MistralGoogleCloud {
    if (!this.mistral) {
      this.mistral = new MistralGoogleCloud({
        projectId: this.config.project,
        region: this.config.region,
      });
    }
    return this.mistral;
  }

  getName(): string {
    return 'gcp-mistral';
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
      const content = response.choices.at(0)?.message.content as string;
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
        const choice = event.data.choices.at(0);
        if (aborted || choice?.finishReason) break;
        let chunk = choice?.delta.content;
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
