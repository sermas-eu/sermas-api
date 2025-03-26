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

// TODO: This implementation was never properly tested.
// Please use it as a base in case you need to integrate
// a Vertex AI model
export class VertexAIChatProvider extends LLMChatProvider {
  private vertexai: VertexAI;

  constructor(protected config: LLMProviderConfig) {
    super(config);
  }

  private getApiClient(): VertexAI {
    if (!this.vertexai) {
      this.vertexai = new VertexAI({
        project: this.config.project,
        location: this.config.region,
      });
    }
    return this.vertexai;
  }

  getName(): string {
    return 'vertexai';
  }

  async available(): Promise<boolean> {
    // TODO: SDK does not provide a health check endpoint
    return true;
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
      generationConfig: {
        maxOutputTokens: 512,
        topP: this.config.top_p,
        temperature: this.config.temperature,
      },
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
    const streamingResult =
      await generativeModel.generateContentStream(request);
    (async () => {
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
