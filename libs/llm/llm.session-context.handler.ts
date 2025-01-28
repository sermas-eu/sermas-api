import { LLMSendArgs } from './llm.provider.dto';

export interface SessionContextHandler {
  getChatServiceByTag(
    config: LLMSendArgs,
  ): Promise<string | undefined> | string | undefined;
}
