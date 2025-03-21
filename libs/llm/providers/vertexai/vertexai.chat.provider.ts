import {
  LLMCallResult,
  LLMChatOptions,
  LLMMessage,
  LLMProviderConfig,
} from '../provider.dto';
import { LLMChatProvider } from '../chat.provider';
import {
  HarmBlockThreshold,
  HarmCategory,
  VertexAI,
} from '@google-cloud/vertexai';
import { ChatMessageStream } from 'libs/llm/stream/chat-message.stream';

export class VertexAIChatProvider extends LLMChatProvider {
  private vertexai: VertexAI;

  constructor(protected config: LLMProviderConfig) {
    super(config);
  }

  private getApiClient(): VertexAI {
    if (!this.vertexai) {
      // TODO: Refactor
      const project = 'sermas-ga-nr-101070351';
      const location = 'europe-west4';
      this.vertexai = new VertexAI({
        project: project,
        location: location,
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
    // TODO: Fix
    const generativeModel = this.getApiClient().getGenerativeModel({
      model: this.config.model,
      // The following parameters are optional
      // They can also be passed to individual content generation requests
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
      generationConfig: { maxOutputTokens: 512 },
    });

    const stream = new ChatMessageStream();
    const request = {
      contents: messages.map((m) => {
        return { role: m.role, parts: [{ text: m.content }] };
      }),
    };

    if (!isStream) {
      const result = await generativeModel.generateContent(request);
      const response = result.response;
      const content = response.candidates?.at(0)?.content.parts.at(0).text; // TODO: Check type
      stream.add(content);
      stream.close();
      return {
        stream,
      };
    }

    let aborted = false;
    (async () => {
      const streamingResult =
        await generativeModel.generateContentStream(request);
      for await (const item of streamingResult.stream) {
        if (aborted) break;
        const chunk = item.candidates?.at(0)?.content.parts.at(0).text; // TODO: Check type
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
