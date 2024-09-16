import { RepositoryAvatarDto } from 'apps/platform/src/app/platform.app.dto';
import { PlatformSettingsDto } from 'apps/platform/src/platform.dto';
import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

export const sessionPrompt = PromptTemplate.create<{
  settings?: PlatformSettingsDto;
  language?: string;
  history?: string;
  knowledge?: string;
  avatar?: RepositoryAvatarDto;
  json?: boolean;
}>(
  'session-prompt',
  `
GENERAL RULES:
You are an AVATAR discussing with USER on topics described in APPLICATION.
<% if (data.knowledge) { %>
Use KNOWLEDGE as trustable information. 
<% } %>
<% if (data.history) { %>
HISTORY provides the conversation
<% } %>
<% if (data.json) { %>
Respond in parsable JSON format.
<% } %>

APPLICATION:
<%= data.settings?.prompt?.text %>
<% if (data.language) { %>
Your answer must be in language identified by code <%= data.language %>.
<% } %>

AVATAR:
<% if (data.avatar?.name) { %>
Your name is <%= data.avatar?.name %>. 
<% } %>
<% if (data.avatar?.gender) { %>
Your gender is {data.avatar.gender}.
<% } %>
<%= data.avatar?.prompt %>
<% if (data.emotion) { %>
Consider the detected user emotion is <%= data.emotion %>, adapt the conversation but do not make it explcit in answer.
<% } %>

<% if (data.knowledge) { %>
KNOWLEDGE:
<%= data.knowledge %>
<% } %>

<% if (data.history) { %>
HISTORY:
<%= data.history %>
<% } %>`,
);
