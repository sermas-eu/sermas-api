import { Injectable, Logger } from '@nestjs/common';
import { SentenceTransformer } from 'apps/dialogue/src/avatar/transformer/sentence.transformer';
import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { parseJSON } from 'libs/llm/util';
import { MonitorService } from 'libs/monitor/monitor.service';
import {
  AvatarChatRequest,
  LLMCombinedResult,
} from './dialogue.chat.avatar.dto';
import {
  avatarChatPrompt,
  avatarSystemChatPrompt,
} from './dialogue.chat.prompt';
import { SelectedTool } from './dialogue.chat.tools.dto';
import { StreamingToolsTransformer } from './transformer/streaming-tools.transformer';
import { convertToolsToPrompt } from './utils';

@Injectable()
export class DialogueChatAvatarService {
  private readonly logger = new Logger(DialogueChatAvatarService.name);

  constructor(
    private readonly monitor: MonitorService,
    private readonly llmProvider: LLMProviderService,
  ) {}

  async send(args: AvatarChatRequest): Promise<LLMCombinedResult> {
    const chatProvider = args.chatArgs?.provider || args.provider;
    const chatModel = args.chatArgs?.model || args.model;

    const promise = new Promise<LLMCombinedResult>(async (resolve) => {
      const result = await this.llmProvider.chat({
        tag: args.tag || 'chat',
        stream: true,
        json: false,

        provider: chatProvider,
        model: chatModel,
        sessionContext: args.sessionContext,

        system: avatarSystemChatPrompt({
          ...args.system,
          tools: convertToolsToPrompt(args.system.tools),
        }),
        user: avatarChatPrompt(args.chat),

        transformers: [
          new StreamingToolsTransformer((rawJson: string) => {
            resolve({
              ...result,
              tools: this.parseMatchingTools(rawJson, args.system.tools),
            });
          }),
          new SentenceTransformer(),
        ],
      });
    });

    return await promise;
  }

  parseMatchingTools(rawJson: string, tools: AppToolsDTO[]) {
    const res = parseJSON<Record<string, any>>(rawJson);

    const selectedTools: SelectedTool[] = [];

    if (!res || !Object.keys(res).length) {
      return selectedTools;
    }

    for (const name in res) {
      const filtered = tools.filter((t) => t.name === name);
      if (!filtered.length) {
        this.logger.warn(
          `Cannot find LLM inferred tool name=${name} avail tools=${tools.map((t) => t.name).join(', ')}`,
        );
        continue;
      }
      const schema = filtered.at(0);
      const tool: SelectedTool = {
        name,
        values: res[name],
        schema: schema,
      };

      selectedTools.push(tool);
    }
    return selectedTools;
  }
}
