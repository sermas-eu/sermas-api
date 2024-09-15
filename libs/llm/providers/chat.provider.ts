import { LLMProvider } from './base.provider';
import {
  LLMCallResult,
  LLMMessage,
  LLMChatOptions,
  LLMProviderConfig,
} from './provider.dto';

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
