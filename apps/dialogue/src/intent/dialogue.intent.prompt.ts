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
  "filter": { "skip": boolean, "explain": boolean },
  "intent": { "taskId": string, "match": boolean, "trigger": boolean, "cancel": boolean, "explain": string }
}
`,
);

export const intentPrompt = PromptTemplate.create<IntentPrompt>(
  'intent-match',
  `Execute the following steps identified as markdown titles.

# FILTER

Identify if a USER MESSAGE is relevant to any of CONVERSATION, APPLICATION, TASKS or TOOLS information.
Populate the filed 'filter' in response.

Decide to set field 'skip' after considering all the following statements:
- Skip if reflecting, self-talking or background noise
- Keep if related to the CONVERSATION or APPLICATION
- Keep if possibly relevant to TASKS
- Keep if meaningful or part of TOOLS

Set the field 'explain' describing your decision.
If message is skipped, do not continue to next steps. 

# INTENTS

<% if (data.activeTask) { %>
  ## ACTIVE TASK
  <%= data.activeTask %>
<% } %>

Analyze the conversation and match one of TASKS based on the user message intention.
Populate the field 'intent' in response. Set taskId only with one from TASKS.

Set the field 'match' to 'true' in those cases:
- if there is an explicit match with an intent
- if the assistant asked explicitly for a task and the user is confirming or declining

Set the field 'trigger' to false except for those cases:
- if user request precisely matches the 'description' field of one TASKS, ignore intents.
- user confirms one of TASKS that has been proposed by the assistant in the last message from CONVERSATION
- ACTIVE TASK is not available

<% if (data.activeTask) { %>
  If the interaction indicates the user want to cancel or not continue or switch to another task, set the field "cancel" to true
<% } %>

Set the field 'explain' describing why you set those values
`,
);
