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

export type LLMChatArgs = LLMProviderConfig & {
  system?: PromptTemplateOutput | string;
  user?: PromptTemplateOutput | string;

  stream?: boolean;
  llmCallId?: string;
};

export type LLMBaseArgs = {
  provider?: LLMProvider;
  model?: string;
  tag?: LLMPromptTag;
  llmCallId?: string;
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
  message: PromptTemplateOutput | string;
} & LLMBaseArgs;

export type LLMParallelResult = LLMCallResult & {
  tools?: SelectedTool[];
};

export type AvatarChat = {
  chat?: PromptTemplateOutput | string;

  tools?: LLMTool[];
  message?: PromptTemplateOutput | string;
} & LLMProviderConfig & {
    chatArgs?: Partial<LLMChatArgs>;
    toolsArgs?: Partial<LLMChatArgs>;
    provider?: LLMProvider;
    skipChat?: boolean;
  };
