import { PromptTemplate } from 'libs/llm/prompt/prompt.template';
import {
  BaseSystemPrompt,
  BaseSystemPromptParams,
} from '../dialogue.system.prompt';

export type IntentSystemPrompt = BaseSystemPromptParams;

export type IntentPrompt = {
  activeTask?: string;
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

## ANSWER FORMAT
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

Identify a USER MESSAGE relevant to CONVERSATION and APPLICATION. Consider those factors to decide:
- Keep messages which contains typos, possibly caused by microphone audio conversion
- Skip input unrelated to the conversation or APPLICATION
- Skip message from the user when reflecting or self-talking
- Keep messages related to intents
- In doubt, keep the message if well formed

If message is skipped, do not continue to next steps.

# INTENTS

<% if (data.activeTask) { %>
  Active task name is <%= data.activeTask %>
<% } %>

Analyze the conversation and match one intent.

Set the field 'match' to 'true' in those cases:
- if there is a direct match
- if the assistant proposed that task in the last two interactions
- if the user had not yet confirmed the task in the last interaction

If the user message request matches directly the intent or confirms an intent previously proposed by the assistant, set the field 'trigger' to 'true'

<% if (data.activeTask) { %>
  If the interaction indicates the user want to cancel or not continue or switch to another task, set the field "cancel" to true
<% } %>`,
);
