import { RepositoryAvatarDto } from 'apps/platform/src/app/platform.app.dto';
import { packPromptObject } from 'libs/llm/prompt/prompt.template';
import { LLMTool } from './dialogue.chat.tools.dto';

export const packAvatarObject = (avatar: RepositoryAvatarDto) => {
  return packPromptObject(avatar, ['name', 'gender', 'prompt']);
};

export const convertToolsToPrompt = (list?: LLMTool[]): string | undefined => {
  if (!list || !list.length) return undefined;

  type PromptTool = {
    name: string;
    description: string;
    params: Record<string, string>;
  };

  const tools: PromptTool[] = [];
  for (const toolDef of list) {
    let params = {};
    if (toolDef.schema) {
      params = toolDef.schema.reduce((res, schema) => {
        if (schema.ignore !== true) {
          res[schema.parameter] = schema.type;
        }
        return res;
      }, params);
    }
    tools.push({
      name: toolDef.name,
      description: toolDef.description,
      params,
    });
  }

  return JSON.stringify(tools);
};
