import { RepositoryAvatarDto } from '#apps/platform/src/app/platform.app.dto';
import { packPromptObject } from '#libs/llm/prompt/prompt.template';
import { LLMTool } from './dialogue.chat.tools.dto.js';

export const packAvatarObject = (avatar: RepositoryAvatarDto) => {
  return packPromptObject(avatar, ['name', 'gender', 'prompt']);
};

/**
 * What a tool shows on screen, in the content's own words (never more than the app
 * wrote): e.g. `link: SERMAS project website; site https://…`.
 */
export const describeToolContent = (ui?: {
  contentType?: string;
  content?: Record<string, any>;
  description?: string;
}): string | undefined => {
  if (!ui?.contentType) return undefined;
  const content = (ui.content || {}) as Record<string, any>;
  const words = [
    ui.description,
    content.label,
    content.title,
    content.alt,
    content.text,
    content.url ? `site ${content.url}` : undefined,
  ]
    .filter((p) => typeof p === 'string' && p.trim())
    .join('; ')
    .slice(0, 300);
  return words ? `${ui.contentType}: ${words}` : ui.contentType;
};

export const convertToolsToPlainList = (
  list?: LLMTool[],
): string | undefined => {
  if (!list || !list.length) return undefined;

  return JSON.stringify(list.map((tool) => tool.description));
};

export const convertToolsToPrompt = (list?: LLMTool[]): string | undefined => {
  if (!list || !list.length) return undefined;

  type PromptTool = {
    name: string;
    description: string;
    params: Record<string, string>;
    // what appears on screen when the tool matches
    shows?: string;
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
      shows: describeToolContent(toolDef.ui),
    });
  }

  return JSON.stringify(tools);
};
