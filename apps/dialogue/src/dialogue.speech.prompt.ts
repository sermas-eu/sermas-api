import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

export type CheckIfUserTalkingToAvatarPromptParam = {
  user: string;
  history?: string;
  appPrompt: string;
  avatar: string;
};

export const checkIfUserTalkingToAvatarPrompt =
  PromptTemplate.create<CheckIfUserTalkingToAvatarPromptParam>(
    'evaluate-user-message',
    `
The task is to skip a user MESSAGE when not part of the conversation with the AVATAR considering those factors:
1. There may be noise caused by other people talking in the room
2. The user may be self-talking to themself.
3. The user talks to the avatar as a real person, do not exclude messages that may be personal, colloquial or harsh.

Answer only with parsable JSON following this structure. Do not add notes or explanations.
{
  skip: boolean, // ignore or not this message
  ask: string // Ask the user to repeat based on context.
}

MESSAGE is a textual input converted from a microphone. APPLICATION defines the context of the conversation.
<% if (data.history) { %> HISTORY provides the conversation. <% } %>

APPLICATION: <%= data.appPrompt %>
<% if (data.avatar) { %>AVATAR: <%= data.avatar %><% } %>

<% if (data.history) { %> HISTORY: <%= data.history %> <% } %>

<% if (data.user) { %> MESSAGE: <%= data.user %> <% } %>`,
  );
