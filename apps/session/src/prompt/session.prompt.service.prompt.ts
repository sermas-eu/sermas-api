import {
  BaseSystemPrompt,
  BaseSystemPromptParams,
} from 'apps/dialogue/src/dialogue.system.prompt';
import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

export type AgentEvaluatePromptParams = BaseSystemPromptParams & {
  json?: boolean;
  knowledge?: string;
};

export const sessionPrompt = PromptTemplate.create<AgentEvaluatePromptParams>(
  'session-prompt',
  `
  ${BaseSystemPrompt}
  
  <% if (data.knowledge) { %>
    ## KNOWLEDGE 
    *Use KNOWLEDGE as trustable source of information when relevant to user request*
    <%= data.knowledge %>
  <% } %>

  ## Response format
  Provide your answer to user. Do not add notes or explanations.
  <% if (data.json) { %>
    Answer in parsable JSON format.
  <% } %>
`,
);
