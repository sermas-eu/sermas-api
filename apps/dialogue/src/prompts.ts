import {
  PlatformAppDto,
  RepositoryAvatarDto,
} from 'apps/platform/src/app/platform.app.dto';
import { PromptTemplate } from 'libs/llm/prompt/template.prompt';

type AppPromptParams = {
  type: 'welcome' | 'goodbye';
  appPrompt?: string;
  language?: string;
  avatar?: {
    name?: string;
    gender?: string;
    prompt?: string;
  };
};

const promptTemplate = PromptTemplate.create<AppPromptParams>(`
This is your context, do not mention it in the answer.
{{ appPrompt }}

{{#if language }}Your message should use the language {{language}}.{{/if}}

You are a digital avatar.
{{#if avatar.name}} Your name is {{avatar.name}}.{{/if}}
{{#if avatar.gender}} Your gender is {{avatar.gender}}.{{/if}}
{{#if avatar.prompt}} {{avatar.prompt}}.{{/if}}


{{#if type === 'welcome' }}
Provide a brief welcome message to the user
{{else}}
Provide a brief goodbye message to the user
{{/if}}
`);

export const createAppPromptParams = (
  type: 'welcome' | 'goodbye',
  app: PlatformAppDto,
  avatar?: RepositoryAvatarDto,
): AppPromptParams => {
  return {
    type,
    appPrompt: app.settings?.prompt?.text,
    language: app.settings?.language,
    avatar,
  };
};

export const createWelcomePrompt = (
  app: PlatformAppDto,
  avatar?: RepositoryAvatarDto,
) => {
  return promptTemplate.render(createAppPromptParams('welcome', app, avatar));
};

export const createGoodbyePrompt = (
  app: PlatformAppDto,
  avatar?: RepositoryAvatarDto,
) => {
  return promptTemplate.render(createAppPromptParams('goodbye', app, avatar));
};
