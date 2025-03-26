import { HfInference, HfInferenceEndpoint } from '@huggingface/inference';
import { ChatCompletionInputMessage } from '@huggingface/tasks';
import {
  LLMCallResult,
  LLMChatOptions,
  LLMMessage,
  LLMProviderConfig,
} from 'libs/llm/providers/provider.dto';
import { ChatMessageStream } from 'libs/llm/stream/chat-message.stream';
import { LLMChatProvider } from '../chat.provider';

export class HuggingfaceChatProvider extends LLMChatProvider {
  private hfInference: HfInference | HfInferenceEndpoint;

  constructor(protected config: LLMProviderConfig) {
    super(config);
  }

  protected createClient() {
    const inference = new HfInference(this.config.apiKey);
    if (this.config.baseURL) {
      return inference.endpoint(this.config.baseURL);
    }
    return inference;
  }

  private getApiClient() {
    if (!this.hfInference) {
      this.hfInference = this.createClient();
    }
    return this.hfInference;
  }

  getName(): string {
    return 'huggingface';
  }

  async available(): Promise<boolean> {
    if (!this.config.apiKey) return false;

    return true;
  }

  public async getModels() {
    // TODO
    return this.models;
  }

  async call(
    chatMessages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMCallResult> {
    const isStream = options?.stream === true || false;

    const messages: ChatCompletionInputMessage[] = [];

    for (const msg of chatMessages) {
      const message = {
        role: msg.role,
        content: msg.content,
      };
      messages.push(message);
    }

    const stream = new ChatMessageStream();

    const completionOpts = {
      model: this.config.model,
      messages: messages,
      max_tokens: 512,
      top_p: this.config.top_p,
      temperature: this.config.temperature,
    };

    if (!isStream) {
      const res = await this.getApiClient().chatCompletion({
        ...completionOpts,
      });
      if (res && res.choices && res.choices?.length) {
        const content = res.choices[0].message.content;
        stream.add(content);
      }
      stream.close();
      return {
        stream,
      };
    }

    // stream
    const result = await this.getApiClient().chatCompletionStream({
      ...completionOpts,
    });

    let aborted = false;
    (async () => {
      for await (const completionChunk of result) {
        if (aborted) break;
        if (!completionChunk || !completionChunk.choices) break;
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
