import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

export type CheckIfUserTalkingToAvatarPromptParam = {
  user: string;
  history?: string;
  appPrompt: string;
  language: string;
  avatar: string;
};

export type UserMessageCheck = {
  skip: boolean;
  repeat: boolean;
  question: string;
};

export const checkIfUserTalkingToAvatarPrompt =
  PromptTemplate.create<CheckIfUserTalkingToAvatarPromptParam>(
    'evaluate-user-message',
    `
Evaluate user MESSAGE based on provided information considering those factors:
1. There may be noise caused by other people talking in the room
2. The user may be self-talking to themself.

Skip the message if it is incomplete or have no meaning. 
Ask to repeat if the message is unclear, such as it seems cutted or poorly registered.

Use language in answer <%= data.language %>

Answer only with parsable JSON following this structure. Do not add notes or explanations.
{
  skip: boolean, // flag to ignore the message
  repeat: boolean, // flag to ask to repeat
  question: string // Question to provide to the user, empty if repeat=false.
}

MESSAGE is a textual input converted from a microphone. APPLICATION defines the context of the conversation.
<% if (data.history) { %> HISTORY provides the conversation. <% } %>

APPLICATION: <%= data.appPrompt %>
<% if (data.avatar) { %>AVATAR: <%= data.avatar %><% } %>

<% if (data.history) { %> HISTORY: <%= data.history %> <% } %>

<% if (data.user) { %> MESSAGE: <%= data.user %> <% } %>`,
  );
