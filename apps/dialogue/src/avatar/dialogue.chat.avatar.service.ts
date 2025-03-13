import { Injectable, Logger } from '@nestjs/common';
import {
  LLMToolsResponse,
  SelectedTool,
} from 'apps/dialogue/src/avatar/dialogue.chat.tools.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { LLMCallResult } from 'libs/llm/providers/provider.dto';
import { MonitorService } from 'libs/monitor/monitor.service';
import { Readable } from 'stream';
import {
  avatarChatPrompt,
  avatarSystemChatPrompt,
} from '../dialogue.chat.prompt';
import {
  AvatarChatRequest,
  AvatarToolsRequest,
  LLMParallelResult,
} from './dialogue.chat.avatar.dto';
import {
  convertToolsToPrompt,
  toolsPrompt,
  toolsSystemPrompt,
} from './dialogue.chat.avatar.prompt';

// type ToolsSchemaValues = string | number | boolean | object | undefined;
// type ToolsSchemaParameters = Record<string, ToolsSchemaValues>;

@Injectable()
export class DialogueChatAvatarService {
  private readonly logger = new Logger(DialogueChatAvatarService.name);

  constructor(
    private readonly monitor: MonitorService,
    private readonly llmProvider: LLMProviderService,
  ) {}

  async tools(args: AvatarToolsRequest): Promise<LLMToolsResponse> {
    try {
      const perf = this.monitor.performance({ label: 'tools' });
      const tools = args.tools || [];

      if (!tools.length || !args.system.history?.length) {
        this.logger.debug(`Skip call, empty tools list or history`);
        perf();
        return {
          tools: [],
        };
      }

      type ToolsResponse = {
        matches: Record<string, Record<string, any>>;
        answer?: string;
      };

      const req = await this.llmProvider.send<ToolsResponse>({
        tag: 'tools',
        stream: false,
        json: true,

        sessionContext: args.sessionContext,
        provider: args.provider,
        model: args.model,

        messages: [
          {
            role: 'system',
            content: toolsSystemPrompt({
              app: args.system.app,
              avatar: args.system.avatar,
              language: args.system.language,
              summary: args.system.history,
              message: args.system.message,
              tools: convertToolsToPrompt(tools),
            }),
          },
          {
            role: 'user',
            content: toolsPrompt({}),
          },
        ],
      });

      const res = req as ToolsResponse;
      perf();

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

      return {
        tools: selectedTools,
        answer: res.answer,
      };
    } catch (e) {
      this.logger.error(`Tools call failed ${e.stack}`);
      return {
        tools: [],
        answer: '',
      };
    }
  }

  // parallelize calls to tools and chat.
  // if tools are found, return the tools stream
  // otherwise return the plain chat response
  // NOTE it creates 2x the call to the provider(s)
  async send(args: AvatarChatRequest): Promise<LLMParallelResult> {
    const perf = {
      tools: this.monitor.performance({ label: 'tools' }),
      chat: this.monitor.performance({ label: 'chat' }),
    };

    const chatProvider = args.chatArgs?.provider || args.provider;
    const chatModel = args.chatArgs?.model || args.model;

    const toolProvider = args.toolsArgs?.provider || args.provider;
    const toolModel = args.toolsArgs?.model || args.model;

    let toolsRequest: Promise<LLMToolsResponse | void> = Promise.resolve();
    if (args.tools && args.system.history?.length) {
      toolsRequest = this.tools({
        provider: toolProvider,
        model: toolModel,
        sessionContext: args.sessionContext,

        system: args.system,
        tools: args.tools,
      });
    }

    let chatRequest: Promise<LLMCallResult | void> = Promise.resolve();
    if (args.chat) {
      chatRequest = this.llmProvider
        .chat({
          tag: args.tag || 'chat',
          stream: true,
          json: false,

          provider: chatProvider,
          model: chatModel,
          sessionContext: args.sessionContext,

          system: avatarSystemChatPrompt(args.system),
          user: avatarChatPrompt(args.chat),
        })
        .then((res: LLMCallResult) => {
          if (!res) return Promise.reject();
          if (res.stream === null) return Promise.reject();
          return Promise.resolve(res);
        });
    }

    const results = await Promise.allSettled([toolsRequest, chatRequest]);

    const [toolsPromise, chatPromise] = results;

    const chatResult =
      chatPromise.status === 'fulfilled' ? chatPromise.value : undefined;
    const selectedTools =
      toolsPromise.status === 'fulfilled' ? toolsPromise.value : undefined;

    if (selectedTools && selectedTools.tools?.length) {
      if (chatResult && chatResult?.abort) chatResult?.abort();
      perf.tools('tools', true);
      return {
        stream: Readable.from([selectedTools.answer || '']),
        tools: selectedTools.tools,
        abort: () => {},
      };
    }

    if (chatResult) {
      perf.chat('chat', true);
      return { stream: chatResult.stream, abort: chatResult.abort };
    }

    return { tools: undefined, stream: undefined };
  }
}
