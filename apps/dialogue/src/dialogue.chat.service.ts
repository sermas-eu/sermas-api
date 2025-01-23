import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppSettingsDto,
  AppToolsDTO,
} from 'apps/platform/src/app/platform.app.dto';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { SessionService } from 'apps/session/src/session.service';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { AvatarChat } from 'libs/llm/llm.provider.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { SelectedTool } from 'libs/llm/tools/tool.dto';
import { MonitorService } from 'libs/monitor/monitor.service';
import { getChunkId, getMessageId } from 'libs/sermas/sermas.utils';
import { DialogueTextToSpeechDto } from 'libs/tts/tts.dto';
import { DialogueToolNotMatchingDto } from './dialogue.chat.dto';
import { avatarChatPrompt } from './dialogue.chat.prompt';
import { DialogueVectorStoreService } from './document/dialogue.vectorstore.service';
import { DialogueIntentService } from './intent/dialogue.intent.service';
import { DialogueMemoryService } from './memory/dialogue.memory.service';
import { DialogueTasksHandlerService } from './tasks/dialogue.tasks.handler.service';
import { DialogueTasksService } from './tasks/dialogue.tasks.service';
import {
  DialogueTaskDto,
  TaskFieldDto,
} from './tasks/store/dialogue.tasks.store.dto';
import {
  TOOL_CATCH_ALL,
  TOOL_CATCH_ALL_VALUE as TOOL_CATCH_ALL_PARAMETER,
} from './tools/dialogue.tools.dto';
import { DialogueToolsService } from './tools/dialogue.tools.service';
import { DialogueToolsRepositoryDto } from './tools/repository/dialogue.tools.repository.dto';
import { ToolTriggerEventDto } from './tools/trigger/dialogue.tools.trigger.dto';
import { extractToolValues } from './tools/utils';

@Injectable()
export class DialogueChatService {
  private readonly logger = new Logger(DialogueChatService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly emitter: EventEmitter2,
    private readonly platformAppService: PlatformAppService,
    private readonly session: SessionService,

    private readonly llmProvider: LLMProviderService,
    private readonly memory: DialogueMemoryService,
    private readonly vectorStore: DialogueVectorStoreService,
    private readonly tools: DialogueToolsService,
    private readonly tasks: DialogueTasksService,
    private readonly tasksHandler: DialogueTasksHandlerService,
    private readonly intent: DialogueIntentService,

    private readonly monitor: MonitorService,
  ) {}

  async inference(
    message: DialogueMessageDto,
    llmArgs?: AvatarChat,
    silent = false,
  ) {
    const { appId, sessionId } = message;

    const app = await this.platformAppService.readApp(appId);
    if (!app) {
      this.logger.warn(`appId=${appId} not found`);
      return;
    }

    const settings = await this.session.getSettings(message);

    if (!llmArgs) {
      const llm = await this.session.getLLM(sessionId);
      llmArgs = {
        chatArgs: llm?.chat
          ? this.llmProvider.extractProviderName(llm?.chat)
          : undefined,
        toolsArgs: llm?.tools
          ? this.llmProvider.extractProviderName(llm?.tools)
          : undefined,
      };
    }

    // search rag context
    const knowledge = await this.vectorStore.search(appId, message.text);

    // load tasks
    // const tasks = await this.tasks.list(appId);
    let tasks: DialogueTaskDto[] = [];
    let taskCancelled: string;

    const intent = await this.intent.match(message);
    if (intent) {
      this.logger.debug(
        `Found task '${intent.task?.name}' taskId=${intent.result?.taskId} ongoing=${intent.record ? true : false} match=${intent.result?.match} trigger=${intent.result?.trigger} cancel=${intent.result?.cancel}`,
      );

      tasks = [intent.task];

      if (intent.result?.cancel && intent.record) {
        this.logger.log(
          `Cancelling ongoing task taskId=${intent.task?.taskId}`,
        );
        await this.tasksHandler.cancelTask({
          sessionId: message.sessionId,
          taskId: intent.task.taskId,
        });
        tasks = [];
        taskCancelled = intent.task.taskId;
      }

      if (
        intent.result?.match &&
        intent.result?.trigger &&
        !intent.record &&
        !intent.result.cancel
      ) {
        const task = intent.task;
        this.logger.log(`Trigger task ${intent.task.name}`);
        const ev: ToolTriggerEventDto = {
          appId: task.appId,
          name: task.name,
          repositoryId: task.taskId,
          sessionId: message.sessionId,
          schema: null,
          source: 'agent',
          values: {
            taskId: task.taskId,
          },
        };
        await this.tasks.trigger(ev);
        return;
      }
    }

    let tasksList = '[]';
    if (tasks && tasks.length) {
      tasksList = JSON.stringify(
        (tasks || []).map((t) => ({
          name: t.name,
          description: t.description,
        })),
      );
    }

    let currentTask = await this.tasks.getCurrentTask(message.sessionId);

    if (currentTask && currentTask.taskId === taskCancelled) {
      currentTask = null;
    }

    let currentField: TaskFieldDto;

    let matchOrRemoveTask = false;

    // load tools repositories
    const sessionRepositories = await this.tools.loadFromSession(message);
    let repositories: DialogueToolsRepositoryDto[] = [];

    if (currentTask) {
      currentField = await this.tasks.getCurrentField(
        currentTask.taskId,
        message.sessionId,
      );

      repositories = sessionRepositories.filter((r) => {
        if (!r.tools) return false;
        return r.tools.filter(
          (t) =>
            (t.schema || []).filter(
              (s) => s.parameter === 'taskId' && s.value === currentTask.taskId,
            ).length > 0,
        );
      });

      matchOrRemoveTask = currentTask.options?.matchOrRemove === true;

      this.logger.debug(`Enabled tools for task name=${currentTask.name}`);
    } else {
      repositories = sessionRepositories;
    }

    const skipChat = false;
    if (currentTask && currentField) {
      this.logger.debug(`Current task field is ${currentField.name}`);
      // skipChat = currentField.required === true && !matchOrRemoveTask;
      // TODO enable fallback answer if no options matches
    }

    // restore tools but filter out cancelled tools for a task, since removal is async and could have not been completed yet
    if (taskCancelled) {
      repositories = sessionRepositories.filter(
        (r) =>
          r.tools.filter(
            (t) =>
              (t.schema || []).filter(
                (s) => s.parameter === 'taskId' && s.value === taskCancelled,
              ).length,
          ).length === 0,
      );
    }

    const isToolExclusive =
      repositories.filter((r) => r.options?.exclusive).length > 0;

    const tools = repositories
      .sort((a, b) =>
        a.options?.exclusive ? -1 : b.options?.exclusive ? -1 : 1,
      )
      .map((r) => (r.tools?.length ? r.tools : []))
      .flat();

    this.logger.debug(
      `Active tools: [${tools.map((t) => `${t.name}: ${t.description}`)}]`,
    );

    let hasCatchAll: AppToolsDTO;
    const matchCatchAll = tools.filter((t) => t.name === TOOL_CATCH_ALL);
    if (matchCatchAll.length) {
      hasCatchAll = matchCatchAll[0];
    }

    // load app and avatar params
    const appPrompt =
      settings?.prompt?.text || app.settings?.prompt?.text || '';

    const avatar = await this.session.getAvatar(message, message.avatar);

    const perf = this.monitor.performance({
      ...message,
      label: 'chat.user',
    });

    // get history
    const summary = await this.memory.getSummary(sessionId);

    const req: AvatarChat = {
      ...(llmArgs || {}),
      chat: avatarChatPrompt({
        appPrompt,
        language: message.language,
        emotion: message.emotion || 'neutral',
        avatar,
        history: summary,
        user: message.text,
        knowledge,
        tasks: tasksList,
        // track current task progress
        task:
          currentTask && (currentTask.hint || currentTask.description)
            ? `${currentTask.name}: ${currentTask.hint || currentTask.description}`
            : undefined,
        field:
          currentField && currentField.hint
            ? `${currentField.label || currentField.name}: ${currentField.hint}`
            : undefined,
      }),

      tools,
      history: summary,

      skipChat,
    };

    const res = await this.llmProvider.avatarChat(req);
    perf();

    const { skipResponse } = await this.handleTools({
      appId,
      sessionId,

      selectedTools: res.tools,
      tools: tools,
      repositories,

      currentField,
      currentTask,
      isToolExclusive,
      matchOrRemoveTask,
      text: message.text,
      hasCatchAll,
      settings,
    });

    if (!res || !res.stream) {
      this.logger.warn(
        `LLM response is empty appId=${appId} sessionId=${sessionId}`,
      );
      return;
    }

    const messageId = getMessageId();

    let chunkBuffer = '';

    const skipChatResponse =
      settings?.chatModeEnabled === false || skipResponse;

    if (skipChatResponse) {
      this.logger.debug(`Skipping chat response.`);
    }

    res.stream
      .on('data', (chunk) => {
        let text = chunk;
        if (res.tools) {
          text = chunk.data;
        }

        if (silent) {
          if (res.tools) {
            // tools matched
            if (chunk.type && chunk.type === 'answer') {
              this.logger.debug(`RESPONSE | ${chunk.data} `);
            }
            return;
          }
          (chunk || '')
            .split('\n')
            .map((text) => this.logger.debug(`RESPONSE | ${text}`));
          return;
        }

        if (skipChatResponse) {
          return;
        }

        chunkBuffer += text;

        const minSplittingSentenceLen = 30;
        const sentenceSplitDelimiters = ['[ ', '. ', '.\n', ': ', ':\n'];
        let toSend = this.splitSentenceOnDelimiter(
          chunkBuffer,
          sentenceSplitDelimiters,
          minSplittingSentenceLen,
        );
        if (toSend != chunkBuffer) {
          chunkBuffer = chunkBuffer.substring(toSend.length);

          // sometimes, somehow it starts the answer like this
          const trimPrefixes = ['ASSISTANT:', 'USER:', 'UTENTE:'];
          trimPrefixes.forEach((trimPrefix) => {
            if (toSend.startsWith(trimPrefix)) {
              toSend = toSend.substring(trimPrefix.length);
            }
          });

          this.sendMessage(message, messageId, toSend);
        }
      })
      .on('end', async () => {
        if (skipChatResponse) return;

        if (chunkBuffer.length > 1) {
          this.sendMessage(message, messageId, chunkBuffer);
        }
        this.logger.verbose(`chat response stream completed`);
      });
  }

  async handleTools(args: {
    appId: string;
    sessionId: string;

    selectedTools: SelectedTool<{
      [param: string]: any;
    }>[];

    tools: AppToolsDTO[];
    repositories: DialogueToolsRepositoryDto[];

    text: string;

    currentTask: DialogueTaskDto;
    currentField: TaskFieldDto;

    hasCatchAll?: AppToolsDTO;
    isToolExclusive: boolean;
    matchOrRemoveTask: boolean;

    settings?: Partial<AppSettingsDto>;
  }) {
    const { appId, sessionId } = args;

    let skipResponse = args.isToolExclusive;

    if (args.selectedTools) {
      skipResponse = args.isToolExclusive || args.settings?.skipToolResponse;

      // tools matched
      // this.logger.debug(`Matching tools ${args.selectedTools.map((t) => t.name)}`);

      for (const tool of args.selectedTools) {
        const matchingRepository = this.tools.getRepositoryByTool(
          args.repositories,
          tool,
        );
        if (!matchingRepository) {
          this.logger.warn(`tool '${tool.name}' not found`);
          continue;
        }

        const matchingTools = (matchingRepository.tools || []).filter(
          (t) => t.name === tool.name,
        );
        const matchingTool = matchingTools.length ? matchingTools[0] : null;

        if (!matchingTool) {
          this.logger.warn(`tool '${tool.name}()' not found`);
          continue;
        }

        const toolschema = matchingTool;
        // skip response from LLM
        if (toolschema.skipResponse === true) {
          skipResponse = true;
        }

        this.logger.debug(`Trigger tool ${tool.name} sessionId=${sessionId}`);
        this.triggerTool({
          tool,
          repository: matchingRepository,
          appId,
          sessionId,
        });
      }
    } else {
      if (args.tools.length) {
        if (args.hasCatchAll) {
          const tool: SelectedTool = {
            name: args.hasCatchAll.name,
            schema: args.hasCatchAll,
            values: {},
          };
          const matchingRepository = this.tools.getRepositoryByTool(
            args.repositories,
            tool,
          );
          if (matchingRepository) {
            this.logger.log(
              `No tools matched, triggering catch all tool '${TOOL_CATCH_ALL}'`,
            );

            if (tool.schema?.schema?.length) {
              tool.schema.schema = tool.schema?.schema.map((s) => {
                if (s.parameter === TOOL_CATCH_ALL_PARAMETER) {
                  s.value = args.text;
                }
                return s;
              });
            }

            this.triggerTool({
              tool,
              repository: matchingRepository,
              appId,
              sessionId,
            });
          }
        } else {
          const notFoundEvent: DialogueToolNotMatchingDto = {
            appId,
            sessionId,
            tools: args.tools,
            repositories: args.repositories,
            currentField: args.currentField,
            currentTask: args.currentTask,
          };
          this.emitter.emit('dialogue.tools.not_matching', notFoundEvent);
          this.monitor.error({
            label: `No tools matching`,
            appId,
            sessionId,
          });
          this.logger.debug(
            `No tools matching, tools=${args.tools.length} [${args.tools.map((t) => t.name + ':' + t.description).join('; ')}]`,
          );

          if (args.matchOrRemoveTask) {
            await this.tasks.remove(args.currentTask.taskId);
            this.logger.warn(
              `User answer does not match task ${args.currentTask.name} tool, removing task.`,
            );
          }
        }
      }
    }

    return {
      skipResponse,
    };
  }

  triggerTool(payload: {
    tool: SelectedTool;
    repository: DialogueToolsRepositoryDto;
    appId: string;
    sessionId: string;
  }) {
    // trigger tool
    const ev: ToolTriggerEventDto = {
      ...payload.tool,
      values: extractToolValues(payload.tool.schema, payload.tool.values),
      appId: payload.appId,
      sessionId: payload.sessionId,
      repositoryId: payload.repository.repositoryId,
      source: 'message',
    };
    this.emitter.emit('dialogue.tool.trigger', ev);
  }

  convertMarkdownLinksToHtml(text: string) {
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    return text.replace(markdownLinkRegex, (match, p1, p2) => {
      return `${p2}`;
    });
  }

  splitSentenceOnDelimiter(
    sentence: string,
    delimiters: string[],
    minSplittingSentenceLen: number,
  ) {
    // find first delimiter match
    for (const d of delimiters) {
      const index = sentence.indexOf(d, minSplittingSentenceLen);
      if (index > -1) {
        sentence = sentence.substring(0, index + 1);
        break;
      }
    }

    return sentence;
  }

  sendMessage(message: DialogueMessageDto, messageId: string, text: string) {
    // ensure links are sent as text
    text = this.convertMarkdownLinksToHtml(text);

    if (this.config.get('LLM_PRINT_RESPONSE') === '1') {
      text.split('\n').forEach((line) => `LLM | ${line}`);
    }

    const responseMessage: DialogueTextToSpeechDto = {
      ...message,
      actor: 'agent',
      text,
      language: message.language,
      ts: new Date(),
      clientId: message.clientId,
      chunkId: getChunkId(),
      messageId,
      appId: message.appId,
      emotion: message.emotion,
    };
    this.emitter.emit('dialogue.chat.message', responseMessage);
  }
}
