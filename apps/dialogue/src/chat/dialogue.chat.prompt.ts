import { PromptTemplate } from 'libs/llm/prompt/prompt.template';
import {
  BaseSystemPrompt,
  BaseSystemPromptParams,
} from '../dialogue.system.prompt';
import { TOOL_CATCH_ALL } from '../tools/dialogue.tools.dto';

export type AvatarChatSystemPromptParams = BaseSystemPromptParams;

export type AvatarChatPromptParams = {
  suggestedTasks?: string;
  task?: string;
  field?: string;
  knowledge?: string;
};

export const avatarSystemChatPrompt =
  PromptTemplate.create<AvatarChatSystemPromptParams>(
    'chat-system',
    `${BaseSystemPrompt}

## Response format
Always follow Example structure in your answer. Provide correct and parsable JSON in markup tags.
Append then the CHAT response as plain text, do not use emoticons. 
Never add Notes or Explanations.

### Example:
<filter>
{ "skip": boolean, "explain": string }
</filter>
<tools>
{ "matches": { "tool name": { "argument name": "value extracted from USER MESSAGE" } }, "explain": string }
</tools>
<intents>
{ "taskId": string, "match": boolean, "trigger": boolean, "cancel": boolean, "explain": string }
</intents>
`,
  );

export const avatarChatPrompt = PromptTemplate.create<AvatarChatPromptParams>(
  'chat',
  `Execute sequentially the following tasks delimited by markdown titles.

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

# TOOLS
Find textual matches for one or more of provided TOOLS list with USER MESSAGE.
Do not interpret logically the user message, match textual correlation.

Follow those rules sequentially, when one matches skip the following.
1. If a tool with name '${TOOL_CATCH_ALL}' is available, match it directly.
2. Using TOOLS 'description' match with at least one of those rules:
a) is equal or has partial overlap, ignore cases b) user message is similar by meaning

Populate the 'matches' field with an object using the tool 'name' field as key and an object as value 
with the key-value of tool param 'name' and value extracted from user message.
Set 'matches' to an empty object if there is no match or no TOOLS are available. 
Set the field 'explain' describing why you set those values, omit if 'tools' is empty.

Never mention tools in the chat response. Skip the next section if a tool is found. 

# INTENTS
<% if (data.activeTask) { %>
  ## ACTIVE TASK: <%= data.activeTask %>
<% } %>

Analyze the conversation and match one of TASKS based on the user message intention.
Populate the field 'intent' in response. Set taskId only with one from TASKS.

Set the field 'match' to 'true' in those cases:
- if there is an explicit match with an intent
- if the assistant asked explicitly for a task and the user is confirming or declining

Set the field 'trigger' to false except for those cases:
- if USER REQUEST precisely match the 'description' field of one of TASKS, ignoring intents.
- user accepts one of TASKS that has been proposed by the assistant in the last message from CONVERSATION
- ACTIVE TASK is not available

<% if (data.activeTask) { %>
  If the interaction indicates the user want to cancel or not continue or switch to another task, set the field "cancel" to true
<% } %>

Set the field 'explain' describing why you set those values. If a task 'match' and 'trigger' are true, skip the next section.

# CHAT RESPONSE
You are an AVATAR (also assistant or agent) discussing with USER in the APPLICATION context. The conversation is speech-based and must be fast and coincise, avoid repetitions.
Answer to USER MESSAGE, based on the overall context information. Ask for clarification if you have no elements to answer precisely.
Never mention tools in the chat response.

<% if (data.field || data.task) { %>

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
    Use KNOWLEDGE when relevant to the user message.
  <% } %>

  <% if (data.suggestedTasks) { %>
    Propose one of TASKS depending on context, be precise in the task offering description.
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

  <% if (data.suggestedTasks) { %>
    ## TASKS:
    <%= data.suggestedTasks %>
  <% } %>

  <% if (data.knowledge) { %>
    ## KNOWLEDGE:
    <%= data.knowledge %>
  <% } %>

<% } %>`,
);
