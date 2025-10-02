export type BaseSystemPromptParams = {
  app?: string;
  avatar?: string;
  language?: string;
  history?: string;
  intents?: string;
  activeTask?: string;
  message?: string;
  emotion?: string;
  tools?: string;
  tasks?: string;
};

export const createBaseSystemPrompt = () => `
## GENERAL RULES
TASKS and TOOLS are managed via external software, never pretend to handle the task yourself.

<% if (data.app) { %>
  ## APPLICATION
  <%= data.app %>
<% } %>
<% if (data.avatar) { %>
  ## AVATAR
  <%= data.avatar %>
<% } %>
<% if (data.language) { %>
  ## LANGUAGE
  Conversation response must always be in language <%= data.language %>
<% } %>
<% if (data.history) { %>
  ## CONVERSATION
  <%= data.history %>
<% } %>
<% if (data.intents) { %>
  ## INTENTS
  <%= data.intents %>
<% } %>
<% if (data.activeTask) { %>
  ## ACTIVE TASK
  <%= data.activeTask %>
<% } %>
<% if (data.tools) { %>
  ## TOOLS
  <%= data.tools %>
<% } %>
<% if (data.tasks)   { %>
  ## TASKS
  <%= data.tasks %>
<% } %>
<% if (data.emotion) { %>
  ## USER EMOTION
  <%= data.emotion %>
<% } %>
<% if (data.message) { %>
  ## USER MESSAGE
  <%= data.message %>
<% } %>
## Datetime: ${new Date().toISOString()}`;
