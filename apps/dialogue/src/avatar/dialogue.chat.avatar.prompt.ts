import {
  BaseSystemPrompt,
  BaseSystemPromptParams,
} from 'apps/dialogue/src/dialogue.system.prompt';
import { PromptTemplate } from 'libs/llm/prompt/prompt.template';
import { LLMTool } from './dialogue.chat.tools.dto';

export type ToolsSystemPromptParams = BaseSystemPromptParams;

export const toolsSystemPrompt = PromptTemplate.create<ToolsSystemPromptParams>(
  'tools-system',
  `${BaseSystemPrompt}
  
Output in parsable JSON, following exactly this structure. Never add Notes or Explanations.
{
  "matches": { 
    "matching TOOL name": { 
      // optional, set only if in TOOL signature
      "a matching TOOL argument name": "the value extracted from USER message" 
    } 
  }
}`,
);

export const toolsPrompt = PromptTemplate.create(
  'tools',
  `Match a tool from TOOLS list with the USER MESSAGE.

Follow strictly all of the following rules:
- find an item based on the 'description' field of each TOOLS.
- there must be a precise match of the tool description with the user request.
- never match a tool if the user is providing a question or asking for clarifications.
- the matching tool must be one of those in TOOLS

If there is no match, return an empty object. Do not mention the name of tools.`,
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
