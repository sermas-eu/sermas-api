import { Logger } from '@nestjs/common';
import { LLMPromptArgs } from '../llm.provider.dto';
import { LLMPrompt } from '../providers/provider.dto';
import { LLMTool } from '../tools/tool.dto';

import {
  historyPrompt,
  jsonPrompt,
  knowledgePrompt,
  toolsPrompt,
  userPrompt,
} from './prompts';

export abstract class BasePrompt {
  protected logger = new Logger(BasePrompt.name);

  mapPrompt(arg: LLMPrompt) {
    let prompt = arg.prompt;
    if (!prompt) {
      this.logger.error(`mapPrompt: prompt is empty`);
      this.logger.debug(`mapPrompt: ${JSON.stringify(arg)}`);

      return '';
    }

    if (arg.params) {
      for (const key in arg.params) {
        let val = arg.params[key];
        const valType = typeof val;

        if (valType === 'boolean') {
          val = val ? 'true' : 'false';
        } else if (valType === 'object') {
          val = JSON.stringify(val);
        } else {
          val = (val || '').toString();
        }

        prompt = prompt.replace(new RegExp(`\{${key}\}`, 'ig'), val);
      }
    }

    return prompt;
  }

  mapMessage(prompt?: string | LLMPrompt, params?: { [key: string]: any }) {
    if (prompt === undefined || prompt === '') return undefined;

    if (typeof prompt === 'string') {
      prompt = {
        prompt,
        params,
      };
    }

    return this.mapPrompt({
      prompt: prompt.prompt,
      params: {
        ...(params || {}),
        ...(prompt.params || {}),
      },
    });
  }

  createPrompt(data: LLMPromptArgs) {
    const params = data.params || {};

    // do not alter system prompt
    if (data.system) {
      return this.mapMessage(data.system, params);
    }

    let prompt = this.mapMessage(data.intro, data.params) || '';

    if (data.tools && data.tools.length) {
      prompt += this.mapPrompt({
        prompt: toolsPrompt,
        params: {
          ...params,
          tasks: params.tasks || '',
          tools: this.convertToolsToPrompt(data.tools),
          toolFallback: params.toolFallback
            ? `use the tool '${params.toolFallback}'`
            : 'return an empty JSON object',
        },
      });
    }

    const knowledge = this.mapMessage(data.knowledge, params);
    if (knowledge) {
      prompt += this.mapPrompt({
        prompt: knowledgePrompt,
        params: {
          ...params,
          knowledge,
        },
      });
    }

    if (data.history && data.history.length) {
      prompt += this.mapPrompt({
        prompt: historyPrompt,
        params: {
          ...params,
          history: data.history
            .map((message, i) => {
              return `${i + 1}. ${message.role.toUpperCase()}: ${message.content}`;
            })
            .join('\n'),
        },
      });
    }

    if (data.json) {
      prompt += jsonPrompt;
    }

    if (data.message) {
      prompt += this.mapPrompt({
        prompt: this.mapMessage(userPrompt, params),
        params: {
          ...params,
          message: data.message,
        },
      });
    }

    return prompt;
  }

  convertToolsToPrompt(list: LLMTool[]): string {
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
  }
}
