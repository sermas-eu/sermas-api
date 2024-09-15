import {
  LLMCallResult,
  LLMMessage,
  LLMPrompt,
  LLMPromptTag,
  LLMProvider,
  LLMProviderConfig,
} from './providers/provider.dto';
import { LLMTool, SelectedTool } from './tools/tool.dto';

export type LLMSendArgs = LLMProviderConfig & {
  messages: LLMMessage[];
  stream: boolean;
  json: boolean;
  llmCallId?: string;
};

export interface LLMPromptArgs {
  // key-value with placeholders
  params?: { [key: string]: any };

  system?: string | LLMPrompt;
  intro?: string | LLMPrompt;

  tools?: LLMTool[];

  history?: LLMMessage[];
  knowledge?: string | LLMPrompt;

  message?: string | LLMPrompt;

  json?: boolean;

  llmCallId?: string;
}

export type LLMChatArgs = LLMProviderConfig &
  LLMPromptArgs & {
    stream?: boolean;
    llmCallId?: string;
  };

export type LLMBaseArgs = {
  provider?: LLMProvider;
  model?: string;

  tag?: LLMPromptTag;
};

export type LLMChatRequest = {
  stream?: boolean;
  json?: boolean;

  messages?: LLMMessage[];
  system?: string;
  user?: string;
} & LLMBaseArgs;

export type LLMToolsArgs = {
  tools: LLMTool[];
} & LLMBaseArgs;

export type LLMParallelResult = LLMCallResult & {
  tools?: SelectedTool[];
};

export type AvatarChat = LLMChatArgs & {
  chatArgs?: Partial<LLMChatArgs>;
  toolsArgs?: Partial<LLMChatArgs>;
  provider?: LLMProvider;
  skipChat?: boolean;
};
