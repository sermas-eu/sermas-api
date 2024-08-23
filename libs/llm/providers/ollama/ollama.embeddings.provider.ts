import { Logger } from '@nestjs/common';
import { LLMEmbeddingConfig } from 'libs/llm/providers/provider.dto';
import { Ollama } from 'ollama';
import { LLMEmbeddingProvider } from '../embeddings.provider';

export class OllamaEmbeddingProvider extends LLMEmbeddingProvider {
  private logger = new Logger(OllamaEmbeddingProvider.name);

  private readonly ollama: Ollama;

  constructor(protected config: LLMEmbeddingConfig) {
    super(config);
    this.models = ['nomic-embed-text', 'all-minilm', 'mxbai-embed-large'];
    this.ollama = this.createClient();
  }

  getName(): string {
    return 'ollama';
  }

  private createClient() {
    const { baseURL } = this.config;
    return new Ollama({
      host: baseURL,
    });
  }

  async generate(input: string[]): Promise<number[][]> {
    input = input instanceof Array ? input : [input];
    const output: number[][] = [];
    for (const prompt of input) {
      try {
        const res = await this.ollama.embeddings({
          model: this.config.model,
          prompt,
        });
        output.push(res.embedding);
      } catch (e: any) {
        this.logger.error(`Failed to generate embeddings: ${e.message}`);
        this.logger.debug(e.stack);
      }
    }
    return this.binaryQuantization(output);
  }
}
