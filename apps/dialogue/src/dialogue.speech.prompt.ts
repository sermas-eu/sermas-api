import { RepositoryAvatarDto } from 'apps/platform/src/app/platform.app.dto';
import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

export type CheckIfUserTalkingToAvatarPromptParam = {
  user: string;
  history?: string;
  appPrompt: string;
  avatar: RepositoryAvatarDto;
};

export const checkIfUserTalkingToAvatarPrompt =
  PromptTemplate.create<CheckIfUserTalkingToAvatarPromptParam>(
    'evaluate-user-message',
    `
The task is to detect if the user MESSAGE should be considered part of the conversation with the AVATAR considering those factors:
1. There may be noise caused by other people talking in the room
2. The user may be self-talking to themself.
3. The user talks to the avatar as a real person, do not exclude messages that may be personal, colloquial or harsh.

Answer in correctly parsable JSON format following this structure
{
  skip: boolean, // ignore or not this message
  ask: string // Must be empty if skip is true. In doubt, ask the user to repeat with a single coincise question.
}

MESSAGE is a textual input converted from a microphone. APPLICATION defines the context of the conversation.
<% if (data.history) { %> HISTORY provides the conversation. <% } %>

APPLICATION: <%= data.appPrompt %>
AVATAR: <% if (data.avatar?.name) { %> Your name is <%= data.avatar?.name %>. <% } %> 
<% if (data.avatar?.gender) { %> Your gender is <%= data.avatar.gender %>.<% } %>
<%= data.avatar?.prompt %>

<% if (data.history) { %> HISTORY: <%= data.history %> <% } %>

<% if (data.user) { %> MESSAGE: <%= data.user %> <% } %>`,
  );
