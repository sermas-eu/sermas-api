import { RepositoryAvatarDto } from 'apps/platform/src/app/platform.app.dto';
import { packPromptObject } from 'libs/llm/prompt/prompt.template';
import { LLMTool } from './dialogue.chat.tools.dto';

export const packAvatarObject = (avatar: RepositoryAvatarDto) => {
  return packPromptObject(avatar, ['name', 'gender', 'prompt']);
};

export const convertToolsToPrompt = (list?: LLMTool[]): string | undefined => {
  if (!list || !list.length) return undefined;

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
