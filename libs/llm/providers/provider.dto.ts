// https://www.deskriders.dev/posts/1702742595-function-calling-ollama-models/
import { Readable } from 'stream';

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
  'groq',
  'antrophic',
  'mistral',
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
}

export interface LLMEmbeddingConfig extends LLMProviderConfig {
  binaryQuantization?: boolean;
}

export class LLMPrompt {
  prompt?: string;
  params?: Record<string, any>;
}

export class LLMChatMessage {
  role: LLMRole;
  content: string;
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
