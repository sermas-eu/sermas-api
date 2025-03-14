import { Injectable, Logger } from '@nestjs/common';
import { SentenceTransformer } from 'apps/dialogue/src/avatar/transformer/sentence.transformer';
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

@Injectable()
export class DialogueChatAvatarService {
  private readonly logger = new Logger(DialogueChatAvatarService.name);

  constructor(
    private readonly monitor: MonitorService,
    private readonly llmProvider: LLMProviderService,
  ) {}

  async send(args: AvatarChatRequest): Promise<LLMCombinedResult> {
    const perf = this.monitor.performance({ label: 'llm.chat' });

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

        system: avatarSystemChatPrompt(args.system),
        user: avatarChatPrompt(args.chat),

        transformers: [
          new StreamingToolsTransformer((rawJson: string) => {
            const matches = parseJSON<{
              [param: string]: any;
            }>(rawJson);
            const tools = parseJSON(args.system.tools);
            resolve({ ...result, tools: this.parseTools(matches, tools) });
          }),
          new SentenceTransformer(),
        ],
      });
    });

    perf();
    return await promise;
  }

  parseTools(res, tools) {
    const selectedTools: SelectedTool[] = [];
    for (const name in res.matches) {
      const filtered = tools.filter((t) => t.name === name);
      if (!filtered.length) {
        this.logger.warn(
          `Cannot find LLM inferred tool name=${name} tools=${tools.map((t) => t.name).join(', ')}`,
        );
        continue;
      }
      const schema = filtered.at(0);
      const tool: SelectedTool = {
        name,
        values: res.matches[name],
        schema: schema,
      };

      selectedTools.push(tool);
    }
    return selectedTools;
  }
}
