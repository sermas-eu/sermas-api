import { RepositoryAvatarDto } from 'apps/platform/src/app/platform.app.dto';
import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

export type EvaluateUserMessagePromptParam = {
  user: string;
  history?: string;
  appPrompt: string;
  avatar: RepositoryAvatarDto;
};

export const avatarEvaluateUserMessagePrompt =
  PromptTemplate.create<EvaluateUserMessagePromptParam>(
    'evaluate-user-message',
    `
The task is to detect if the user MESSAGE should be considered part of the conversation with the AVATAR considering those factors:
1. There may be noise caused by other people talking in the room
2. The user may be self-talking to themself.

Answer in JSON format following this structure
{
  skip: boolean, // keep or not this message
  probability: number, // a float in range 0-1 indicating the probability
  reason: string // provide a rationale regarding the decision
}

MESSAGE is a textual input converted from a microphone.
APPLICATION define the context of the conversation.
<% if (data.history) { %>
HISTORY provides the conversation.
<% } %>

APPLICATION:
<%= data.appPrompt %>
AVATAR:
<% if (data.avatar?.name) { %>
Your name is <%= data.avatar?.name %>. 
<% } %>
<% if (data.avatar?.gender) { %>
Your gender is <%= data.avatar.gender %>.
<% } %>
<%= data.avatar?.prompt %>

<% if (data.history) { %>
HISTORY:
<%= data.history %>
<% } %>

<% if (data.user) { %>
USER:
<%= data.user %>
<% } %>

`,
  );
