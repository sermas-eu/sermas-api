import { Mistral } from '@mistralai/mistralai';
import { Logger } from '@nestjs/common';
import { LLMEmbeddingConfig } from 'libs/llm/providers/provider.dto';
import { LLMEmbeddingProvider } from '../embeddings.provider';

export class MistralEmbeddingProvider extends LLMEmbeddingProvider {
  private logger = new Logger(MistralEmbeddingProvider.name);
  private readonly mistral: Mistral;

  constructor(protected config: LLMEmbeddingConfig) {
    super(config);

    // https://docs.mistral.ai/getting-started/models/
    this.models = ['mistral-embed'];

    this.mistral = new Mistral({
      apiKey: this.config.apiKey,
    });
  }

  getName(): string {
    return 'mistral';
  }

  async generate(inputs: string[]): Promise<number[][]> {
    inputs = inputs instanceof Array ? inputs : [inputs];
    try {
      const res = await this.mistral.embeddings.create({
        model: this.config.model,
        inputs,
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
