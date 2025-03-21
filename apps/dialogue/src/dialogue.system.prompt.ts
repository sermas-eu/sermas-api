export type BaseSystemPromptParams = {
  app?: string;
  avatar?: string;
  language?: string;
  history?: string;
  intents?: string;
  message?: string;
  emotion?: string;
  tools?: string;
  tasks?: string;
};

export const BaseSystemPrompt = `
<% if (data.app) { %>
  ## APPLICATION
  <%= data.app %>
<% } %>
<% if (data.avatar) { %>
  ## AVATAR
  <%= data.avatar %>
<% } %>
<% if (data.language) { %>
  ## USE LANGUAGE
  <%= data.language %>
<% } %>
<% if (data.history) { %>
  ## CONVERSATION
  <%= data.history %>
<% } %>
<% if (data.intents) { %>
  ## INTENTS
  <%= data.intents %>
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
<% } %>`;
