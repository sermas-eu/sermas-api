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
<%= data.values %>

CONDITION:
<%= data.condition %>`,
);

export const taskFieldExpressionPrompt = PromptTemplate.create<{
  values: string;
  fieldPrompt: string;
}>(
  'task-field-expression',
  `
Given this JSON object:
<%= data.values %>

<%= data.fieldPrompt %>
Return a parsable JSON object with format { "result": value }.
Do not add additional notes or explanation.`,
);

export const taskFieldValidationPrompt = PromptTemplate.create<{
  field: TaskFieldDto;
  value: any;
  rules: string;
  language?: string;
}>(
  'task-field-validation',
  `
Validate and convert the USER value to type <%= data.field.type %> following RULES.
Provide a reason if the USER value cannot be validated or converted and set value to null.
Always answer in parsable JSON format with structure { value: "converted value", reason: "non-technical motivation in case of failure" }
Do not add additional notes or explanation.
<% if (data.language) { %>
  Use language <%= data.language %> in your answers
<% } %>

USER: <%= data.value %>

RULES: 
<%= data.rules %>

<% if (data.field?.validation) { %>
  <%= data.field?.validation %>
<% } %>
`,
);

export const taskFieldRephrasePrompt = PromptTemplate.create<{
  basePrompt: string;
  language?: string;
  label?: string;
}>(
  'task-field-rephrase',
  `
<%= data.basePrompt %>

Rephrase USER message. Do not add notes or explanations.
<% if (data.language) { %>
Translate to language <%= data.language %> 
<% } %>

<% if (data.label) { %>
USER: <%= data.label %>
<% } %>`,
);
