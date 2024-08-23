import { Logger } from '@nestjs/common';
import { LLMEmbeddingConfig } from 'libs/llm/providers/provider.dto';
import OpenAI from 'openai';
import { LLMEmbeddingProvider } from '../embeddings.provider';
import { createClient } from './util';

export class OpenAIEmbeddingProvider extends LLMEmbeddingProvider {
  private logger = new Logger(OpenAIEmbeddingProvider.name);
  private readonly openai: OpenAI;

  constructor(protected config: LLMEmbeddingConfig) {
    super(config);

    // https://platform.openai.com/docs/guides/embeddings/embedding-models
    this.models = [
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002',
    ];

    this.openai = createClient(config);
  }

  getName(): string {
    return 'openai';
  }

  async generate(input: string[]): Promise<number[][]> {
    input = input instanceof Array ? input : [input];
    try {
      const res = await this.openai.embeddings.create({
        model: this.config.model,
        input,
        encoding_format: 'float',
      });
      const embeddings = res.data.map((e) => e.embedding);
      return this.binaryQuantization(embeddings);
    } catch (e: any) {
      this.logger.error(`Failed to generate embeddings: ${e.message}`);
      this.logger.debug(e.stack);
      return [];
    }
  }
}
