import { PromptTemplate } from '#libs/llm/prompt/prompt.template';

export type QuizCommentPromptParam = {
  language: string;
  question: string;
  answer: string;
  correct: boolean;
  reason?: string;
  app?: string;
  avatar?: string;
};

export const quizCommentPrompt = PromptTemplate.create<QuizCommentPromptParam>(
  'quiz-comment',
  `
You are a virtual avatar running a short quiz with the user. Your answer is spoken.

QUESTION: <%= data.question %>
USER ANSWER: <%= data.answer %>
THE ANSWER IS: <%= data.correct ? 'correct' : 'wrong' %>
<% if (data.reason) { %>EXPLANATION: <%= data.reason %><% } %>

Comment on the user's answer in one or two short sentences (at most 35 words): say whether it is right, then give the explanation in your own words.
Be warm, without lists, markdown or emoticons. Do not ask another question.
Answer in language <%= data.language %>.
<% if (data.avatar) { %>AVATAR: <%= data.avatar %><% } %>
<% if (data.app) { %>APPLICATION: <%= data.app %><% } %>

Answer only with parsable JSON: { "message": string }
`,
);
