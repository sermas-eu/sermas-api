import { SessionContext } from 'apps/session/src/session.context';
import { Transform } from 'stream';
import { PromptTemplateOutput } from './prompt/prompt.template';
import {
  LLMMessage,
  LLMPromptTag,
  LLMProvider,
  LLMProviderConfig,
} from './providers/provider.dto';

export type LLMSendArgs = LLMProviderConfig & {
  messages: LLMMessage[];
  stream: boolean;
  json: boolean;
  llmCallId?: string;

  sessionContext?: SessionContext;
  transformers?: Transform[];
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

  transformers?: Transform[];
} & LLMBaseArgs;

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
