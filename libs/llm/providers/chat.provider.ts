import { LLMProvider } from './base.provider';
import {
  LLMCallResult,
  LLMChatMessage,
  LLMChatOptions,
  LLMProviderConfig,
} from './provider.dto';

export abstract class LLMChatProvider extends LLMProvider<LLMProviderConfig> {
  abstract getName(): string;
  abstract call(
    messages: LLMChatMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMCallResult>;
  abstract available(): Promise<boolean>;

  getModel(): string {
    return this.config.model;
  }
}
