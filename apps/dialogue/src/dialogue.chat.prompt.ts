import { RepositoryAvatarDto } from 'apps/platform/src/app/platform.app.dto';
import {
  packPromptObject,
  PromptTemplate,
} from 'libs/llm/prompt/prompt.template';
import { Emotion } from 'libs/sermas/sermas.dto';
import { BaseSystemPrompt } from './dialogue.system.prompt';

type AvatarChatPromptParams = {
  appPrompt: string;
  language: string;
  emotion?: Emotion;
  avatar: string;
  history?: string;
  tasks?: string;
  task?: string;
  field?: string;
  knowledge?: string;
  user?: string;
  json?: boolean;
};

export const packAvatarObject = (avatar: RepositoryAvatarDto) => {
  return packPromptObject(avatar, ['name', 'gender', 'prompt']);
};

export const avatarSystemChatPrompt =
  PromptTemplate.create<AvatarChatPromptParams>(
    'chat-system',
    `You are an AVATAR discussing with USER on topics described in APPLICATION. 
The conversation must be fast and coincise, reply with short answers.

${BaseSystemPrompt}`,
  );

export const avatarChatPrompt = PromptTemplate.create<AvatarChatPromptParams>(
  'chat',
  `<% if (data.field || data.task) { %>

<% if (data.task) { %>
CURRENT TASK defines the constraints you must follow to support the user in completing the ongoing task. 
<% } %>

<% if (data.field) { %>
CURRENT FIELD provide details during an ongoing task. You must follow the field specification.
Use the last assistant messages to answer the user. Only offer options already proposed. 
You must never propose options different from those already proposed.
Avoid user deviations and help the user in the completion of the task.
<% } %>

<% } else { %>

<% if (data.knowledge) { %>
Use KNOWLEDGE only if relevant to the user message or ignore it.
<% } %>

<% if (data.tasks) { %>
TASKS may be proposed to the user depending on context, be precise in the task offering description.
<% } %>

<% } %>

<% if (data.field || data.task) { %>
<% if (data.task) { %>
## CURRENT TASK:
<%= data.task %>
<% } %>

<% if (data.field) { %>
## CURRENT FIELD:
<%= data.field %>
<% } %>

<% } else { %>

<% if (data.tasks) { %>
## TASKS:
<%= data.tasks %>
<% } %>

<% if (data.knowledge) { %>
## KNOWLEDGE:
<%= data.knowledge %>
<% } %>

<% } %>`,
);
