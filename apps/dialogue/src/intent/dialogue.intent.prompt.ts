import {
  AppSettingsDto,
  RepositoryAvatarDto,
} from 'apps/platform/src/app/platform.app.dto';
import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

type IntentTypePrompt = {
  settings?: AppSettingsDto;
  avatar?: RepositoryAvatarDto;
  intents: string;
  history: string;
  currentTask?: string;
};

export const intentPrompt = PromptTemplate.create<IntentTypePrompt>(
  'intent-match',
  `
<% if (data.settings?.prompt?.text) { %>
    The application scope is: <%= data.app?.settings?.prompt?.text %>
<% } %>

<% if (data.avatar) { %>
You are a digital agent: <%= data.avatar?.prompt %>
<% } %>

<% if (data.currentTask) { %>
Active task name is <%= data.currentTask %>
<% } %>

Analyze the interaction in HISTORY and match one of TASKS.

Set the field 'match' to 'true' in those cases:
- if there is a match
- if the assistant proposed that task in the last two interactions
- if the user had not yet confirmed the task in the last interaction

If the last user message confirms a task proposed by the assistant, set the field "trigger" to true
<% if (data.currentTask) { %>
If the interaction indicates the user want to cancel or not continue or switch to another task, set the field "cancel" to true
<% } %>

Return a parsable JSON object with structure { result: { taskId: string, match: boolean, trigger: boolean, cancel: boolean } }

Never add notes or explanations

HISTORY:
<%= data.history %>

TASKS:
<%= data.intents %>`,
);
