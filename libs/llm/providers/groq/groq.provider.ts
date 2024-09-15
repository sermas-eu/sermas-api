import Groq from 'groq-sdk';
import {
  LLMCallResult,
  LLMMessage,
  LLMChatOptions,
  LLMProviderConfig,
} from 'libs/llm/providers/provider.dto';
import { ChatMessageStream } from '../../stream/chat-message.stream';
import { LLMChatProvider } from '../chat.provider';
import { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';

export class GroqChatProvider extends LLMChatProvider {
  private readonly groq: Groq;

  constructor(protected config: LLMProviderConfig) {
    super(config);
    this.groq = this.createClient();
  }

  getName(): string {
    return 'grok';
  }

  async available(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    return true;
  }

  private createClient() {
    const { apiKey, baseURL } = this.config;
    return new Groq({
      baseURL,
      apiKey,
    });
  }

  public async getModels() {
    if (this.models === undefined) {
      const models = await this.groq.models.list();
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

    if (!isStream) {
      const res = await this.groq.chat.completions.create({
        top_p: 1,
        max_tokens: 1024,
        temperature: 1,
        model: this.config.model,
        messages,
        stream: false,
      });
      const content = res.choices[0].message.content;
      stream.add(content);
      stream.close();
      return {
        stream,
      };
    }

    const res = await this.groq.chat.completions.create({
      top_p: 1,
      max_tokens: 1024,
      temperature: 1,
      model: this.config.model,
      messages,
      stream: true,
    });

    let aborted = false;

    (async () => {
      for await (const part of res) {
        if (aborted) break;
        const chunk = part.choices[0].delta.content;
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
