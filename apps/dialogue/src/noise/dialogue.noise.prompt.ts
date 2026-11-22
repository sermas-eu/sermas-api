import { PromptTemplate } from '#libs/llm/prompt/prompt.template';

export type NoisyRoomPromptParam = {
  language: string;
  app?: string;
  avatar?: string;
};

export const noisyRoomPrompt = PromptTemplate.create<NoisyRoomPromptParam>(
  'noisy-room',
  `
You are a virtual avatar talking with people through a microphone.
Your last few attempts to hear the user failed: the room seems noisy, or other people are talking nearby.

Write ONE short, friendly sentence (at most 20 words) telling the user it is hard to hear them and suggesting they type their message with the on-screen keyboard instead.
Do not apologise more than once, do not use emoticons, do not add notes.
Answer in language <%= data.language %>.
<% if (data.avatar) { %>AVATAR: <%= data.avatar %><% } %>
<% if (data.app) { %>APPLICATION: <%= data.app %><% } %>

Answer only with parsable JSON: { "message": string }
`,
);
