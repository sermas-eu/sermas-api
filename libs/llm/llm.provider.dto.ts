import { PromptTemplateOutput } from './prompt/prompt.template';
import {
  LLMCallResult,
  LLMMessage,
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
  system?: PromptTemplateOutput | string;
  user?: PromptTemplateOutput | string;

  tools?: LLMTool[];

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
  system?: PromptTemplateOutput | string;
  user?: PromptTemplateOutput | string;
} & LLMBaseArgs;

export type LLMToolsArgs = {
  tools: LLMTool[];
  user: PromptTemplateOutput | string;
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
