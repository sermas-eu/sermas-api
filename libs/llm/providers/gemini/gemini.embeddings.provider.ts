import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { Logger } from '@nestjs/common';
import { LLMEmbeddingConfig } from 'libs/llm/providers/provider.dto';
import { LLMEmbeddingProvider } from '../embeddings.provider';

export class GeminiEmbeddingProvider extends LLMEmbeddingProvider {
  private logger = new Logger(GeminiEmbeddingProvider.name);
  private readonly gemini: GenerativeModel;

  constructor(protected config: LLMEmbeddingConfig) {
    super(config);

    // https://ai.google.dev/gemini-api/docs/models/gemini
    this.models = ['text-embedding-004'];

    this.gemini = this.createClient();
  }

  protected createClient() {
    const genai = new GoogleGenerativeAI(this.config.apiKey);
    return genai.getGenerativeModel({
      model: this.config.model,
    });
  }

  getName(): string {
    return 'gemini';
  }

  async generate(input: string[]): Promise<number[][]> {
    input = input instanceof Array ? input : [input];
    try {
      const res = await this.gemini.batchEmbedContents({
        requests: input.map((text) => ({
          content: { role: 'user', parts: [{ text }] },
        })),
      });
      const embeddings = res.embeddings.map((r) => r.values);
      return this.binaryQuantization(embeddings);
    } catch (e: any) {
      this.logger.error(`Failed to generate embeddings: ${e.message}`);
      this.logger.debug(e.stack);
      return [];
    }
  }
}