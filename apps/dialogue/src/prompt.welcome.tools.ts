import { PromptTemplate } from 'libs/llm/prompt/template.prompt';

type WelcomeToolsPromptParams = {
  language?: string;
  tools: string;
};

export const welcomeToolsPrompt =
  PromptTemplate.create<WelcomeToolsPromptParams>(
    'welcome-message-tools',
    `
Return a JSON array of strings with the value of 'label' field.
If the field 'rephrase' is true, rephrase to be a button label otherwise return the same label.
<%  if (language) { %>
Translate all the resulting labels to language <%= language %>.
<% } %>
Never add comments or explanations.

<%= tools %>`,
  );
