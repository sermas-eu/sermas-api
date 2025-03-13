export type BaseSystemPromptParams = {
  app?: string;
  avatar?: string;
  language?: string;
  summary?: string;
  intents?: string;
  message?: string;
  emotion?: string;
  tools?: string;
};

export const BaseSystemPrompt = `
<% if (data.app) { %>## DOMAIN: <%= data.app %> <% } %>

<% if (data.avatar) { %>## AVATAR: <%= data.avatar %> <% } %>

<% if (data.language) { %>## USE LANGUAGE: <%= data.language %> <% } %>

<% if (data.summary) { %>## CONVERSATION: <%= data.summary %> <% } %>

<% if (data.intents) { %>## INTENTS: <%= data.intents %> <% } %>

<% if (data.tools) { %>## TOOLS: <%= data.tools %> <% } %>

<% if (data.emotion) { %>## USER EMOTION: <%= data.emotion %> <% } %>

<% if (data.message) { %>## USER MESSAGE: <%= data.message %> <% } %>
`;
