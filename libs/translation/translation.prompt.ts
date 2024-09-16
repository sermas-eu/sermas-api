import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

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

Answer the user exclusively with the translated text, avoid any further reasoning. 
Keep the original text formatting. 
If you cannot translate, return the exact user text. 
Never add Notes or Explanations.`,
);
