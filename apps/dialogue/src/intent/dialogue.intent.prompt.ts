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
  filter: { skip: boolean, explain: boolean },
  intent: { taskId: string, match: boolean, trigger: boolean, cancel: boolean, explain: string }
}
`,
);

export const intentPrompt = PromptTemplate.create<IntentPrompt>(
  'intent-match',
  `Execute the following steps identified as markdown titles.

# FILTER

Identify a USER MESSAGE relevant to CONVERSATION and APPLICATION. 
Populate the filed 'filter' in response.

Consider those factors to decide:
- Keep messages which contains typos, possibly caused by microphone audio conversion
- Skip input unrelated to the conversation or APPLICATION
- Skip message from the user when reflecting or self-talking
- Keep messages related to intents
- Keep any other message

Set the field 'skip' and the field 'explain' describing your decision.
If message is skipped, do not continue to next steps. 

# INTENTS

<% if (data.activeTask) { %>
  ## ACTIVE TASK
  <%= data.activeTask %>
<% } %>

Analyze the conversation and match one 'intent' from TASKS based on the user message intention. 
Populate the field 'intent' in response.

Set the field 'match' to 'true' in those cases:
- if there is an explicit match with an intent
- if the assistant asked explicitly for one intent and the user is confirming or declining
- if the user is not asking for clarification or general information

Set the field 'trigger' to 'true' in those cases:
- user is not asking for clarifications or information
- user intention matches precisely the task description
- user confirms a task that has been proposed by the assistant in the last message from CONVERSATION
- ACTIVE TASK is not available

<% if (data.activeTask) { %>
  If the interaction indicates the user want to cancel or not continue or switch to another task, set the field "cancel" to true
<% } %>

Set the field 'explain' describing why you set those values
`,
);
