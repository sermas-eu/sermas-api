import { PromptTemplate } from 'libs/llm/prompt/prompt.template';
import {
  BaseSystemPrompt,
  BaseSystemPromptParams,
} from '../dialogue.system.prompt';

export type IntentSystemPrompt = BaseSystemPromptParams;

export type IntentPrompt = {
  currentTask?: string;
};

export type IntentResponse = {
  skip: boolean;
  intent: {
    taskId: string;
    match: boolean;
    trigger: boolean;
    cancel: boolean;
  };
};

export const intentSystemPrompt = PromptTemplate.create<IntentSystemPrompt>(
  'intent-match-system',
  `${BaseSystemPrompt}

Answer with a parsable JSON object collecting all steps and formatted as following. Do not add notes or explanations.
{
  skip: boolean,
  intent: { taskId: string, match: boolean, trigger: boolean, cancel: boolean }
}
`,
);

export const intentPrompt = PromptTemplate.create<IntentPrompt>(
  'intent-match',
  `Execute the following steps identified as markdown titles.

# FILTER

Identify a USER MESSAGE relevant to CONVERSATION and DOMAIN. Consider those factors to decide:
- Keep messages which contains typos, possibly caused by microphone audio conversion
- Skip unrelated input which seems coming by other people in the room
- Skip message which seems be a reflection or self-talking from the user

If message is skipped, do not continue to next steps.

# INTENTS

<% if (data.currentTask) { %>
Active task name is <%= data.currentTask %>
<% } %>

Analyze the conversation and match one intent.

Set the field 'match' to 'true' in those cases:
- if there is a match
- if the assistant proposed that task in the last two interactions
- if the user had not yet confirmed the task in the last interaction

If the user message confirms a task proposed by the assistant, set the field "trigger" to true
<% if (data.currentTask) { %>
If the interaction indicates the user want to cancel or not continue or switch to another task, set the field "cancel" to true
<% } %>`,
);
