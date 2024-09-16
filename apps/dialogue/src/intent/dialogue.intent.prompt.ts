import {
  PlatformAppDto,
  RepositoryAvatarDto,
} from 'apps/platform/src/app/platform.app.dto';
import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

type IntentTypePrompt = {
  app?: PlatformAppDto;
  avatar?: RepositoryAvatarDto;
  intents: string;
  history: string;
};

export const intentPrompt = PromptTemplate.create<IntentTypePrompt>(
  'intent-match',
  `
<% if (data.app?.settings?.prompt?.text) { %>
    The application scope is: <%= data.app?.settings?.prompt?.text %>
<% } %>

<% if (data.avatar) { %>
You are a digital agent: <%= data.avatar?.prompt %>
<% } %>

Analyze user interaction in HISTORY and match one of TASKS.

Set the  field 'match' to 'false' in those cases:
- if there is no match
- if the assistant already asked for a task in the last two interactions
- if the user confirmed a task in the last interaction

If the last user message confirm a task proposed by the assistant, set the field "trigger" to true
If the last user message indicate they want to cancel the task, set the field "cancel" to true

Return a parsable JSON object with structure { result: { taskId: string, match: boolean, trigger: boolean, cancel: boolean } }

Never add notes or explanations

HISTORY:
<%= data.history %>

TASKS:
<%= data.intents %>`,
);
