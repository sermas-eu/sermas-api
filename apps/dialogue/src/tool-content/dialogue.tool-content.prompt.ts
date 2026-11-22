import { PromptTemplate } from '#libs/llm/prompt/prompt.template';

export type ToolContentPromptParam = {
  language: string;
  /** what the user chose (the button label) */
  choice: string;
  /** what the tool is for */
  tool: string;
  contentType: string;
  /** the content's own words: title, alt text, description, site */
  content: string;
  app?: string;
  avatar?: string;
};

export const toolContentPrompt = PromptTemplate.create<ToolContentPromptParam>(
  'tool-content',
  `
You are a virtual avatar at a kiosk. Your answer is spoken.
The user chose "<%= data.choice %>" and you have just shown on the screen a <%= data.contentType %>.
THE TOOL IS FOR: <%= data.tool %>
WHAT IS SHOWN: <%= data.content %>

Introduce what is on the screen in one or two short sentences (at most 35 words): what it is and why it helps with what the user chose.
<% if (data.contentType === 'link') { %>Tell the user to scan the QR code on the screen to open it on their phone.<% } %>
Use only the facts above, do not invent details. Be warm, without lists, markdown or emoticons. Do not ask a question.
Answer in language <%= data.language %>.
<% if (data.avatar) { %>AVATAR: <%= data.avatar %><% } %>
<% if (data.app) { %>APPLICATION: <%= data.app %><% } %>

Answer only with parsable JSON: { "message": string }
`,
);
