// https://www.deskriders.dev/posts/1702742595-function-calling-ollama-models/
import { Readable } from 'stream';
import { PromptTemplateOutput } from '../prompt/prompt.template';

export const LLMPromptTagList = [
  'chat',
  'tools',
  'sentiment',
  'tasks',
  'translation',
  'intent',
] as const;
export type LLMPromptTag = (typeof LLMPromptTagList)[number];

export const LLMProviderList = [
  'ollama',
  'openai',
  'gemini',
  'groq',
  'antrophic',
  'mistral',
  'azure_openai',
];
export type LLMProvider = (typeof LLMProviderList)[number];

export const LLMRoleList = ['system', 'user', 'assistant'] as const;
export type LLMRole = (typeof LLMRoleList)[number];

export interface LLMProviderConfig {
  provider?: LLMProvider;
  model?: string;
  availableModels?: string[];
  baseURL?: string;
  apiKey?: string;
  prompt?: string;
  tag?: LLMPromptTag;
  apiVersion?: string;
}

export interface LLMEmbeddingConfig extends LLMProviderConfig {
  binaryQuantization?: boolean;
}

export class LLMPrompt {
  prompt?: string;
  params?: Record<string, any>;
}

export class LLMMessage {
  role: LLMRole;
  content: string | PromptTemplateOutput;
}

export interface LLMChatOptions {
  json?: boolean;
  stream?: boolean;
}

export interface LLMCallResult {
  stream: Readable;
  // streaming only
  abort?: () => void;
}
