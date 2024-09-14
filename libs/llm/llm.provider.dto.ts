import {
  LLMCallResult,
  LLMChatMessage,
  LLMPrompt,
  LLMProvider,
  LLMProviderConfig,
} from './providers/provider.dto';
import { LLMTool, SelectedTool } from './tools/tool.dto';

export interface LLMPromptArgs {
  // key-value with placeholders
  params?: { [key: string]: any };

  system?: string | LLMPrompt;
  intro?: string | LLMPrompt;

  tools?: LLMTool[];

  history?: LLMChatMessage[];
  knowledge?: string | LLMPrompt;

  message?: string | LLMPrompt;

  json?: boolean;

  llmCallId?: string;
}

export type LLMChatArgs = LLMProviderConfig &
  LLMPromptArgs & {
    stream?: boolean;
  };

export type LLMChatRequest = {
  provider?: LLMProvider;
  system?: string;
  message?: string;
  model?: string;
  stream?: boolean;
  json?: boolean;
};

export type LLMParallelResult = LLMCallResult & {
  tools?: SelectedTool[];
};

export type AvatarChat = LLMChatArgs & {
  chatArgs?: Partial<LLMChatArgs>;
  toolsArgs?: Partial<LLMChatArgs>;
  provider?: LLMProvider;
  skipChat?: boolean;
};
