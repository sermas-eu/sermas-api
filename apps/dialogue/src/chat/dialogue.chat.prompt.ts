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
  activeTask?: string;
  field?: string;
  knowledge?: string;
};

export const avatarSystemChatPrompt =
  PromptTemplate.create<AvatarChatSystemPromptParams>(
    'chat-system',
    `${BaseSystemPrompt}

## Response format
Strictly follow the following Example structure in your answer. Provide correct and parsable JSON in markup tags.
Append then the CHAT response as plain text, do not use emoticons. 
Never add Notes or Explanations.

### Example:
<filter>
{ "skip": boolean, "answer": string, "explain": string }
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

Identify if USER MESSAGE could be relevant to any of CONVERSATION, APPLICATION, TASKS or TOOLS.
Populate the field 'filter' in response.

Set 'skip' to true when message is clearly self-talking or an incomplete formulation (like from background noise), leave 'answer' empty.
Set 'skip' to false when message is a well formatted and correct message, even if not relevant.

Set the field 'explain' describing your decision.
Set the field 'answer' to provide feedback to the user.
If message is skipped, do not continue to next steps. 

# TOOLS
Find matches of provided TOOLS list with USER MESSAGE. 

Follow those rules sequentially, when one matches skip the following.
- If a tool with name '${TOOL_CATCH_ALL}' is available, match it directly. Exception if there is an ACTIVE TASK and user want to cancel or abort it.
- match strictly the USER REQUEST to be equal or part of TOOLS 'description'.
- the USER MESSAGE should have a match by meaning or partial overlap with the description of one TOOLS.

Populate the 'matches' field with an object using the tool 'name' field as key and an object as value 
with the key-value of tool param 'name' and value extracted from user message.
Set 'matches' to an empty object if there is no match or no TOOLS are available. 
Set the field 'explain' describing why you set those values, omit if 'tools' is empty.

Never mention tools in the chat response. Skip the next section if a tool is found. 

# INTENTS

Analyze CONVERSATION and match one of TASKS based on the USER MESSAGE intention.
Populate the field 'intent' in response. 

Set the field 'match' to 'true' only in those cases:
- if there is an explicit match with an intent
- if the assistant asked explicitly in the previous message for a task and the user is confirming or declining

Set the field 'trigger' to 'true' only in those cases:
- if USER MESSAGE equals or has partial overlap to TASKS 'description', ignore intents.
- if user accepts a task proposed by the assistant in the previous message

If an ACTIVE TASK is available, set 'trigger' to false.

Set 'taskId' only with one from TASKS that has 'match' true.

<% if (data.activeTask) { %>
  If the interaction indicates the user want to cancel or not continue or switch to another task, set the field "cancel" to true
<% } %>

Set the field 'explain' describing why you set match,trigger and cancel values. If a task 'match' and 'trigger' are true, skip the next section.

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

  Propose one of TASKS that has been set to 'match' true in the INTENTS section.

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

  <% if (data.knowledge) { %>
    ## KNOWLEDGE:
    <%= data.knowledge %>
  <% } %>

<% } %>`,
);
