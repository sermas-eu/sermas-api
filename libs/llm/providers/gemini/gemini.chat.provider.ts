import {
  Content,
  GenerativeModel,
  GoogleGenerativeAI,
  GenerationConfig,
} from '@google/generative-ai';
import {
  LLMCallResult,
  LLMChatOptions,
  LLMMessage,
  LLMProviderConfig,
} from 'libs/llm/providers/provider.dto';
import { ChatMessageStream } from 'libs/llm/stream/chat-message.stream';
import { LLMChatProvider } from '../chat.provider';

export class GeminiChatProvider extends LLMChatProvider {
  private gemini: GenerativeModel;

  constructor(protected config: LLMProviderConfig) {
    super(config);
    this.models = [
      'gemini-1.0-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash-8b',
      'gemini-1.5-flash',
    ];
  }

  protected createClient() {
    const genai = new GoogleGenerativeAI(this.config.apiKey);
    const config: GenerationConfig = {
      topP: this.config.top_p,
      temperature: this.config.temperature,
    };
    return genai.getGenerativeModel({
      model: this.config.model,
      generationConfig: config,
    });
  }

  private getApiClient() {
    if (!this.gemini) {
      this.gemini = this.createClient();
    }
    return this.gemini;
  }

  getName(): string {
    return 'gemini';
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

    const messages: Content[] = [];

    for (const msg of chatMessages) {
      // TODO handle function
      const message: Content = {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [
          {
            text: msg.content,
          },
        ],
      };
      messages.push(message);
    }

    const stream = new ChatMessageStream();

    if (!isStream) {
      const res = await this.getApiClient().generateContent({
        contents: messages,
      });

      // const response = res as OpenAI.Chat.Completions.ChatCompletion;
      const content = res.response.text();
      stream.add(content);
      stream.close();
      return {
        stream,
      };
    }

    const result = await this.getApiClient().generateContentStream({
      contents: messages,
    });

    let aborted = false;
    (async () => {
      for await (const completionChunk of result.stream) {
        if (aborted) break;
        const chunk = completionChunk.text();
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
