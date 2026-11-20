import { LLMProvider } from './base.provider.js';
import {
  LLMCallResult,
  LLMMessage,
  LLMChatOptions,
  LLMProviderConfig,
} from './provider.dto.js';

export abstract class LLMChatProvider extends LLMProvider<LLMProviderConfig> {
  abstract getName(): string;
  abstract call(
    messages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMCallResult>;
  abstract available(): Promise<boolean>;

  getModel(): string {
    return this.config.model;
  }
}
