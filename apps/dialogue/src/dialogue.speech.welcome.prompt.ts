import { AppSettingsDto } from 'apps/platform/src/app/platform.app.dto';
import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

export const welcomeToolsPrompt = PromptTemplate.create<{
  language?: string;
  tools: string;
}>(
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

export const welcomeMessagePrompt = PromptTemplate.create<{
  type: 'welcome' | 'goodbye';
  settings?: Partial<AppSettingsDto>;
  avatar?: {
    name?: string;
    gender?: string;
    prompt?: string;
  };
}>(
  'welcome-message',
  `
This is your context, do not mention it in the answer.
<%= settings?.prompt?.text %>

<% if (settings?.language) { %>
Your message should use the language <%= settings?.language %>.
<% } %>

You are a digital avatar.
<% if (avatar.name) { %>
- Your name is <%= avatar.name %>.
<% } %>
<% if (avatar.gender) { %>
- Your gender is <%= avatar.gender %>.
<% } %>
<% if (avatar.prompt) { %>
- <%= avatar.prompt %>.
<% } %>

<% if (type === 'welcome') { %>
Provide a brief welcome message to the user
<% } else { %>
Provide a brief goodbye message to the user
<% } %>`,
);
