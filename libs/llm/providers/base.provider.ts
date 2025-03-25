import { LLMModelAdapter } from './adapter';
import { LLMProviderConfig } from './provider.dto';

export abstract class LLMProvider<
  T extends LLMProviderConfig = LLMProviderConfig,
> {
  protected models?: string[];
  protected adapters: { [key: string]: LLMModelAdapter } = {};

  constructor(protected config: T) {
    this.setConfig(config);
    if (config.availableModels) {
      this.models = config.availableModels;
    }
  }

  protected async init() {
    await this.getModels();
  }

  protected destroy(): Promise<void> | void {
    //
  }

  public async getModels() {
    return this.models;
  }

  public async checkModel(model: string) {
    // This tries to load models into this.models.
    await this.getModels();
    // If no model list is available, we skip the check
    if (this.models === undefined) return true;
    const modelName: string = model.split(':')[0];
    return this.models.some((m) => {
      const parts = m.split(':');
      const isWildcard = parts.length > 1 && parts[1] === '*';
      return (
        m === model || // Perfect match
        (parts[0] === modelName && model === modelName) || // Name match (tag was not specified)
        (parts[0] === modelName && isWildcard) // Wildcard match
      );
    });
  }

  getAdapter(model: string) {
    if (this.adapters[model]) {
      return this.adapters[model];
    }
    for (const key in this.adapters) {
      const pos = key.indexOf('*');
      if (pos === -1) continue;
      if (model.startsWith(key.substring(0, pos))) return this.adapters[key];
    }
    return undefined;
  }

  async setConfig(config?: Partial<T>): Promise<T> {
    this.config = { ...this.config, ...config };
    return this.config;
  }

  async getConfig(): Promise<T> {
    return this.config;
  }
}
