import { SessionContext } from 'apps/session/src/session.context';
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

  sessionContext?: SessionContext;
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

  // provides sessionId to track request context
  sessionContext?: SessionContext;
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
  history?: string;
  user?: string;
} & LLMBaseArgs;

export type LLMParallelResult = LLMCallResult & {
  tools?: SelectedTool[];
};

export type AvatarChat = {
  chat?: PromptTemplateOutput | string;

  tools?: LLMTool[];
  history?: string;
  user?: string;
} & LLMProviderConfig & {
    chatArgs?: Partial<LLMChatArgs>;
    toolsArgs?: Partial<LLMChatArgs>;
    provider?: LLMProvider;
    skipChat?: boolean;

    sessionContext?: SessionContext;
  };

export type LLMResultEvent = {
  sessionId?: string;
  appId?: string;
  ts?: Date;
  provider: LLMProvider;
  model: string;
  tag: LLMPromptTag;
  messages: LLMMessage[];
  params?: LLMMessage[];
  response: string;
  llmCallId: string;
};
