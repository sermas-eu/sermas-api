import { LLMProvider } from './base.provider';
import { LLMEmbeddingConfig } from './provider.dto';

export abstract class LLMEmbeddingProvider extends LLMProvider<LLMEmbeddingConfig> {
  abstract getName(): string;
  abstract generate(texts: string | string[]): Promise<number[][]>;

  protected binaryQuantization(embeddings: number[][]) {
    if (!this.config?.binaryQuantization) return embeddings;
    return embeddings.map((v) => v.map((val) => (val > 0 ? 1 : 0)));
  }
}
