import { LLMSendArgs } from './llm.provider.dto.js';

export interface SessionContextHandler {
  getChatServiceByTag(
    config: LLMSendArgs,
  ): Promise<string | undefined> | string | undefined;
}
