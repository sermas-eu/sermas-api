export const PromptTemplateTypeList = ['llama3', 'generic'] as const;
export type PromptTemplateType = (typeof PromptTemplateTypeList)[number];

export type PromptMessageRole = 'system' | 'assistant' | 'user';

export interface PromptMessage {
  role: PromptMessageRole;
  message: string;
}

export interface PromptTemplate {
  generate(messages: PromptMessage[]): string;
}
