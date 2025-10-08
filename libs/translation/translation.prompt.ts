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
Translate to language code <%= data.toLanguage %>.
<% if (data.fromLanguage) { %>
Original language code is <%= data.fromLanguage %>.
<% } else { %>
If the text is the same language, skip the translation.
<% } %>

Answer only with the translated text, keeping the original text formatting. Never add Notes or Explanations.
If you cannot translate, return the exact original text.`,
);
