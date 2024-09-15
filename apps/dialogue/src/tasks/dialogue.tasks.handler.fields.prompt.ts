import { PromptTemplate } from 'libs/llm/prompt/prompt.template';
import { TaskFieldDto } from './store/dialogue.tasks.store.dto';

export const taskFieldConditionPrompt = PromptTemplate.create<{
  condition: string;
  values: string;
}>(
  'task-field-condition',
  `
Evaluate CONDITION based on VALUES
Return a parsable JSON object with format { "result": boolean }
Never add explanation or comments.

VALUES:
<%= values %>

CONDITION:
<%= condition %>`,
);

export const taskFieldExpressionPrompt = PromptTemplate.create<{
  values: string;
  fieldPrompt: string;
}>(
  'task-field-expression',
  `
Given this JSON object:
<%= values %>

<%= fieldPrompt %>
Return a parsable JSON object with format { "result": value }.
Do not add notes or explanations.`,
);

export const taskFieldValidationPrompt = PromptTemplate.create<{
  values: string;
  field: TaskFieldDto;
  value: any;
  rules: string;
  language?: string;
}>(
  'task-field-validation',
  `
Validate and convert the USER value to type <%= field.type %> following RULES.
Provide a reason if the USER value cannot be validated or converted and set value to null
Answer in parsable JSON format with structure { value: "converted value", reason: "non-technical motivation in case of failure" }
Do not additional notes or explanation.
<% if (language) { %>
Use language <%= language %> in your answers
<% } %>

USER:
<%= value %>

RULES:
<%= rules %>

<%= field.validation %>`,
);

export const taskFieldRephrasePrompt = PromptTemplate.create<{
  basePrompt: string;
  language?: string;
}>(
  'task-field-rephrase',
  `
<%= basePrompt %>

You have to rephrase the user message.
Do not add notes or explanations.
<% if (language) { %>
Translate to language <%= language %> 
<% } %>`,
);