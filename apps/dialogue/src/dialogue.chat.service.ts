import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { SessionService } from 'apps/session/src/session.service';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { AvatarChat } from 'libs/llm/llm.provider.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { chatPrompt } from 'libs/llm/prompt/prompts';
import { SelectedTool } from 'libs/llm/tools/tool.dto';
import { MonitorService } from 'libs/monitor/monitor.service';
import { getChunkId, getMessageId } from 'libs/sermas/sermas.utils';
import { DialogueTextToSpeechDto } from 'libs/tts/tts.dto';
import { DialogueToolNotMatchingDto } from './dialogue.chat.dto';
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

    // get history
    const history = await this.memory.getMessages(sessionId);

    // search rag context
    const knowledge = await this.vectorStore.search(appId, message.text);

    // load tools repositories
    let repositories = await this.tools.loadFromSession(message);

    // load tasks
    // const tasks = await this.tasks.list(appId);
    let tasks: DialogueTaskDto[] = [];
    let taskCancelled: string;

    const intent = await this.intent.match(message);
    if (intent) {
      this.logger.debug(
        `Found taskId=${intent.result?.taskId} trigger=${intent.result?.trigger}`,
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
        this.logger.log(`Trigger task ${intent.result.taskId}`);
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

    const tasksList = (tasks || []).map((t) => ({
      name: t.name,
      description: t.description,
    }));

    let currentTask = await this.tasks.getCurrentTask(message.sessionId);

    if (currentTask && currentTask.taskId === taskCancelled) {
      currentTask = null;
    }

    let currentField: TaskFieldDto;

    let matchOrRemoveTask = false;

    if (currentTask) {
      currentField = await this.tasks.getCurrentField(
        currentTask.taskId,
        message.sessionId,
      );

      repositories = repositories.filter((r) => {
        if (!r.tools) return false;
        return r.tools.filter(
          (t) =>
            (t.schema || []).filter(
              (s) => s.parameter === 'taskId' && s.value === currentTask.taskId,
            ).length > 0,
        );
      });

      matchOrRemoveTask = currentTask.options?.matchOrRemove === true;

      this.logger.debug(`Selecting tools matching ${currentTask.name}`);
    }

    let skipChat = false;
    if (currentField) {
      this.logger.debug(`Task field is ${currentField.name}`);
      skipChat = currentField.required === true && !matchOrRemoveTask;
      // TODO enable fallback answer if no options matches
    }

    const isToolExclusive =
      repositories.filter((r) => r.options?.exclusive).length > 0;

    const tools = repositories
      .sort((a, b) =>
        a.options?.exclusive ? -1 : b.options?.exclusive ? -1 : 1,
      )
      .map((r) => (r.tools?.length ? r.tools : []))
      .flat();

    // this.logger.debug(`Tools: ${tools.map((t) => t.name)}`);

    let hasCatchAll: AppToolsDTO;
    const matchCatchAll = tools.filter((t) => t.name === TOOL_CATCH_ALL);
    if (matchCatchAll.length) {
      hasCatchAll = matchCatchAll[0];
    }

    // load app and avatar params
    const appPrompt =
      settings?.prompt?.text || app.settings?.prompt?.text || '';

    let avatarPrompt = '';
    let avatarName = '';
    let avatarGender = message.gender;

    const avatarSettings = await this.session.getAvatar(
      message,
      message.avatar,
    );

    if (avatarSettings) {
      avatarPrompt = avatarSettings.prompt;
      avatarGender = avatarGender || avatarSettings.gender;
      avatarName = avatarSettings.name;
    }

    const params = {
      appId: message.appId,
      language: message.language,
      emotion: message.emotion || 'neutral',
      gender: avatarGender
        ? avatarGender === 'M'
          ? 'male'
          : 'female'
        : 'not defined',
      appPrompt,
      avatarPrompt,
      avatarName,
      // use the tool as fallback if it is exclusive.
      toolFallback:
        isToolExclusive && tools.length === 1 ? tools[0].name : undefined,

      tasks: JSON.stringify(tasksList),
      // tasks: '',
    };

    // inference

    const perf = this.monitor.performance({
      ...message,
      label: 'chat.user',
    });

    const req: AvatarChat = {
      ...(llmArgs || {}),
      params,
      system: chatPrompt,
      message: message.text,
      history,
      tools,
      knowledge,
      skipChat,
    };

    const res = await this.llmProvider.avatarChat(req);
    perf();

    const getRepositoryByTool = (
      repositories: DialogueToolsRepositoryDto[],
      tool: SelectedTool,
    ) => {
      const matchingRepositories = (repositories || []).filter(
        (r) => (r.tools || []).filter((t) => t.name === tool.name).length,
      );
      const matchingRepository = matchingRepositories.length
        ? matchingRepositories[0]
        : null;
      return matchingRepository || null;
    };

    let skipResponse = isToolExclusive;

    if (res.tools) {
      skipResponse =
        isToolExclusive ||
        settings?.skipToolResponse ||
        app.settings?.skipToolResponse;

      // tools matched
      // this.logger.debug(`Matching tools ${res.tools.map((t) => t.name)}`);

      for (const tool of res.tools) {
        const matchingRepository = getRepositoryByTool(repositories, tool);
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
          appId: app.appId,
          sessionId,
        });
      }
    } else {
      if (tools.length) {
        if (hasCatchAll) {
          const tool: SelectedTool = {
            name: hasCatchAll.name,
            schema: hasCatchAll,
            values: {},
          };
          const matchingRepository = getRepositoryByTool(repositories, tool);
          if (matchingRepository) {
            this.logger.log(
              `No tools matched, triggering catch all tool '${TOOL_CATCH_ALL}'`,
            );

            if (tool.schema?.schema?.length) {
              tool.schema.schema = tool.schema?.schema.map((s) => {
                if (s.parameter === TOOL_CATCH_ALL_PARAMETER) {
                  s.value = message.text;
                }
                return s;
              });
            }

            this.triggerTool({
              tool,
              repository: matchingRepository,
              appId: app.appId,
              sessionId,
            });
          }
        } else {
          const notFoundEvent: DialogueToolNotMatchingDto = {
            appId,
            sessionId,
            tools,
            repositories,
            currentField,
            currentTask,
          };
          this.emitter.emit('dialogue.tools.not_matching', notFoundEvent);
          this.monitor.error({
            label: `No tools matching`,
            appId: app.appId,
            sessionId,
          });
          this.logger.debug(
            `No tools matching, tools=${tools.length} [${tools.map((t) => t.name + ':' + t.description).join('; ')}]`,
          );

          if (matchOrRemoveTask) {
            await this.tasks.remove(currentTask.taskId);
            this.logger.warn(
              `User answer does not match task ${currentTask.name} tool, removing task.`,
            );
          }
        }
      }
    }

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
