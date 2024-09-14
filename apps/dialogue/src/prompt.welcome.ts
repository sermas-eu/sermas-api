import {
  PlatformAppDto,
  RepositoryAvatarDto,
} from 'apps/platform/src/app/platform.app.dto';
import { PromptTemplate } from 'libs/llm/prompt/template.prompt';

type WelcomePromptParams = {
  type: 'welcome' | 'goodbye';
  appPrompt?: string;
  language?: string;
  avatar?: {
    name?: string;
    gender?: string;
    prompt?: string;
  };
};

const promptTemplate = PromptTemplate.create<WelcomePromptParams>(
  'welcome-message',
  `
This is your context, do not mention it in the answer.
<%= appPrompt %>

<% if (language) { %>
Your message should use the language <%= language %>.
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

export const createAppPromptParams = (
  type: 'welcome' | 'goodbye',
  app: PlatformAppDto,
  avatar?: RepositoryAvatarDto,
): WelcomePromptParams => {
  return {
    type,
    appPrompt: app.settings?.prompt?.text,
    language: app.settings?.language,
    avatar,
  };
};

export const welcomePrompt = (
  app: PlatformAppDto,
  avatar?: RepositoryAvatarDto,
) => {
  return promptTemplate(createAppPromptParams('welcome', app, avatar));
};

export const goodbyePrompt = (
  app: PlatformAppDto,
  avatar?: RepositoryAvatarDto,
) => {
  return promptTemplate(createAppPromptParams('goodbye', app, avatar));
};
