import { PromptTemplate } from '../prompt/prompt.template';
import { LLMTool } from './tool.dto';

export const toolsPrompt = PromptTemplate.create<{
  tools: string;
  user: string;
}>(
  'tools',
  `
Your task is to match one of the TOOLS with the USER message.

Follow strictly all of the following rules:
- find an item based on the 'description' field of each TOOLS.
- there must be a precise match of the tool description with the user request.
- never match a tool if the user is providing a question or asking for clarifications.
- the matching tool must be one of those in TOOLS

If there is no match, return an empty object
Confirm in one short sentence the selected tool but never ask or engage the user with additional questions. 
Do not mention the name of tools. 
Never add Notes or Explanations.

Output in parsable JSON, following exactly this structure:
{
  "matches": { 
    "matching TOOL name": { 
      // optional, set only if in TOOL signature
      "a matching TOOL argument name": "the value extracted from USER message" 
    } 
  },
  answer: "your contextual answer"
}


TOOLS:
<%= data.tools %>

<% if (data.user) { %>
USER:
<%= data.user %>
<% } %>`,
);

export const convertToolsToPrompt = (list: LLMTool[]): string => {
  type PromptToolArg = { [key: string]: string };

  type PromptTool = {
    name: string;
    description: string;
    arguments: PromptToolArg;
  };

  const tools: PromptTool[] = [];
  for (const toolDef of list) {
    let params: PromptToolArg = {};
    if (toolDef.schema) {
      params = toolDef.schema.reduce((res, schema) => {
        if (schema.ignore !== true) {
          res = {
            ...res,
            [schema.parameter]: schema.type,
          };
        }
        return res;
      }, {});
    }
    tools.push({
      name: toolDef.name,
      description: toolDef.description,
      arguments: params,
    });
  }

  return JSON.stringify(tools);
};
