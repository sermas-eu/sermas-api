import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

export const detectionPrompt = PromptTemplate.create(
  'language-detection',
  `Your task is to detect precisely the language as a two letter code.
Answer the user exclusively with the language code, avoid any further reasoning. 
If you cannot detect the language, return unknown. 
Do not add Notes or Explanations.`,
);

export const translationPrompt = PromptTemplate.create<{
  toLanguage: string;
  fromLanguage?: string;
}>(
  'translation',
  `
Your task is to translate to language identified by code <%= data.toLanguage %>.
<% if (data.fromLanguage) { %>
Original language code is <%= data.fromLanguage %>.
<% } else { %>
Please infer the original language of the text.
<% } %>

Answer only with the translated text, keep the original text formatting. Never add Notes or Explanations.
If you cannot translate, return the exact original text.`,
);
