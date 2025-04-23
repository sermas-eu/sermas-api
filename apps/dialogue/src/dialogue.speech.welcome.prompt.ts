import { PromptTemplate } from 'libs/llm/prompt/prompt.template';
import {
  createBaseSystemPrompt,
  BaseSystemPromptParams,
} from './dialogue.system.prompt';

export const welcomeMessageSystemPrompt =
  PromptTemplate.create<BaseSystemPromptParams>(
    'welcome-message-system',
    `${createBaseSystemPrompt()}
## Response format
Answer in parsable JSON format as follow. Do not add notes or explanations.
{
  "message": string // message for the user
  "labels": string[] // list of labels
}
`,
  );

export const welcomeMessagePrompt = PromptTemplate.create<{
  type: 'welcome' | 'goodbye';
  tools: string;
}>(
  'welcome-message',
  `## MESSAGE
Produce a single phrase message, avoid details defined in context.

<% if (data.type === 'welcome') { %> 
  Provide a brief welcome message to the user
<% } else { %> 
  Provide a brief goodbye message to the user
<% } %>

## LABELS

Return a JSON array of strings with the value of 'label' field.
If the field 'rephrase' is true, rephrase to be a button label otherwise return the same label.

<%= data.tools %>`,
);
