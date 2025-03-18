import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DialogueMemoryService } from 'apps/dialogue/src/memory/dialogue.memory.service';
import { DialogueTasksService } from 'apps/dialogue/src/tasks/dialogue.tasks.service';
import { createSessionContext } from 'apps/session/src/session.context';
import { SessionService } from 'apps/session/src/session.service';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { packAvatarObject } from '../avatar/utils';
import {
  DialogueChatValidationEvent,
  DialogueToolNotMatchingDto,
} from '../dialogue.chat.dto';
import {
  DialogueTaskDto,
  TaskFieldDto,
} from '../tasks/store/dialogue.tasks.store.dto';
import { intentPrompt, intentSystemPrompt } from './dialogue.intent.prompt';

import {
  TOOL_CATCH_ALL,
  TOOL_CATCH_ALL_VALUE,
} from '../tools/dialogue.tools.dto';

import {
  AppSettingsDto,
  AppToolsDTO,
} from 'apps/platform/src/app/platform.app.dto';
import { SelectedTool } from '../avatar/dialogue.chat.tools.dto';
import { DialogueTasksHandlerService } from '../tasks/dialogue.tasks.handler.service';
import { DialogueToolsService } from '../tools/dialogue.tools.service';
import { DialogueToolsRepositoryDto } from '../tools/repository/dialogue.tools.repository.dto';
import { ToolTriggerEventDto } from '../tools/trigger/dialogue.tools.trigger.dto';
import { extractToolValues } from '../tools/utils';
import {
  ActiveTaskRecord,
  IntentActiveTools,
  TaskIntentMatch,
  TaskIntentMatchResult,
  TaskIntentResult,
  TaskIntentsList,
  TaskIntentWrapper,
} from './dialogue.intent.dto';

@Injectable()
export class DialogueIntentService {
  private readonly logger = new Logger(DialogueIntentService.name);

  constructor(
    private readonly session: SessionService,
    private readonly llm: LLMProviderService,

    private readonly emitter: EventEmitter2,
    private readonly memory: DialogueMemoryService,
    private readonly tasks: DialogueTasksService,

    private readonly tools: DialogueToolsService,
    private readonly tasksHandler: DialogueTasksHandlerService,
    private readonly monitor: MonitorService,
  ) {}

  async getActiveTaskRecord(sessionId: string): Promise<ActiveTaskRecord> {
    const currentRecord = await this.tasks.getCurrentRecord(sessionId);

    if (currentRecord) {
      const currentTask = await this.tasks.getCurrentTask(sessionId);
      this.logger.debug(
        `There is an ongoing task ${currentTask ? 'name=' + currentTask.name : ''}`,
      );

      return { record: currentRecord, task: currentTask };
    }

    return { record: undefined, task: undefined };
  }

  async getTaskIntentList(appId: string) {
    const tasks = await this.tasks.search({ appId });

    const intents: TaskIntentsList[] = tasks.map(
      (t): TaskIntentsList => ({
        taskId: t.taskId,
        description: t.description,
        intents: t.intents.filter((i) => i.name && i.description),
      }),
    );

    return { tasks, intents };
  }

  async match(
    message: DialogueMessageDto,
  ): Promise<TaskIntentMatchResult | null> {
    const activeTask = await this.getActiveTaskRecord(message.sessionId);

    const userMessage = message.text;
    const history = await this.memory.getSummary(message.sessionId);
    const settings = await this.session.getSettings(message);
    const avatar = await this.session.getAvatar(message);

    const { tasks, intents } = await this.getTaskIntentList(message.appId);

    const perf = this.monitor.performance({
      ...message,
      label: 'intents',
    });

    const llm = await this.session.getLLM(message.sessionId);

    const response = await this.llm.chat<TaskIntentMatch>({
      ...this.llm.extractProviderName(llm?.intent),
      stream: false,
      json: true,
      system: intentSystemPrompt({
        app: settings.prompt.text,
        avatar: packAvatarObject(avatar),
        language: settings.language,
        history: history,
        intents: JSON.stringify(intents),
        message: userMessage,
      }),
      user: intentPrompt({
        activeTask: activeTask.task?.name,
      }),
      tag: 'intent',
      sessionContext: createSessionContext(message),
    });

    perf();

    // handle skip case
    const validationEvent: DialogueChatValidationEvent = {
      appId: message.appId,
      sessionId: message.sessionId,
      message: message,
      skip: response?.skip,
    };
    this.emitter.emit('dialogue.chat.validation', validationEvent);

    const result: TaskIntentMatchResult = {
      skipResponse: response?.skip === true,
    };

    if (response?.skip) {
      this.logger.debug(`Skipping user request message=${message.text}`);
      return result;
    }

    // handle intent case
    if (response?.intent) {
      result.task = await this.handleTaskIntent({
        message,
        taskIntent: response.intent,
        activeTask,
        tasks,
      });
      // skip response?
      result.skipResponse = result.task.skipResponse;
    } else {
      this.logger.debug(`Intent not found for sessionId=${message.sessionId}`);
    }

    result.tools = await this.retrieveCurrentTools(result.task, message);

    return result;
  }

  /**
   * Handle LLM task intention
   * - check if user want to perform a task (match + trigger)
   * - check if user want to cancel a task (match + cancel)
   * - list suggested tasks based on conversation (match only)
   */
  async handleTaskIntent(data: {
    tasks: DialogueTaskDto[];
    taskIntent: TaskIntentWrapper;
    message: DialogueMessageDto;
    activeTask: ActiveTaskRecord;
  }): Promise<TaskIntentResult> {
    const { activeTask, taskIntent, message, tasks } = data;

    let suggestedTasks: DialogueTaskDto[] = [];
    let cancelledTaskId: string | undefined = undefined;

    // currently running task
    let currentTask = activeTask.task;
    // LLM identified task to be run (becomes currentTask)
    let selectedTask: DialogueTaskDto;
    // LLM proposed task
    let matchingTask: DialogueTaskDto;
    let skipResponse = false;

    if (taskIntent.taskId) {
      // match by taskId or name, LLM takes it sometimes
      const matches = tasks.filter(
        (t) => t.taskId === taskIntent.taskId || t.name === taskIntent.taskId,
      );
      matchingTask = matches.length ? matches[0] : undefined;
    }

    this.logger.debug(
      `Task intent name=${matchingTask?.name} taskId=${taskIntent?.taskId} match=${taskIntent?.match} trigger=${taskIntent?.trigger} cancel=${taskIntent?.cancel}`,
    );

    // user asked to cancel an ongoing task
    if (taskIntent?.cancel && activeTask.record) {
      this.logger.log(
        `Cancelling ongoing task taskId=${activeTask.task?.taskId}`,
      );
      await this.tasksHandler.cancelTask({
        sessionId: message.sessionId,
        taskId: activeTask.task?.taskId,
      });

      suggestedTasks = tasks;
      cancelledTaskId = activeTask.task?.taskId;
      selectedTask = undefined;
      currentTask = undefined;
    }

    // provide the matching task based on conversation
    if (matchingTask && taskIntent?.match && !taskIntent?.trigger) {
      suggestedTasks = matchingTask ? [matchingTask] : [];
    }

    // a task matches and user confirmed for it.
    // NOTE: Cannot start if another task is ongoing, is it ok ?
    if (
      taskIntent?.match &&
      taskIntent?.trigger &&
      !activeTask.task &&
      !cancelledTaskId
    ) {
      if (matchingTask) {
        selectedTask = matchingTask;
      } else {
        // identified task not found
        this.logger.debug(
          `LLM identified task not matching, skipping taskId=${taskIntent.taskId}`,
        );

        selectedTask = undefined;
        taskIntent.taskId = undefined;
      }

      if (selectedTask) {
        this.logger.log(`Trigger task ${selectedTask.name}`);

        const ev: ToolTriggerEventDto = {
          appId: selectedTask.appId,
          name: selectedTask.name,
          repositoryId: selectedTask.taskId,
          sessionId: message.sessionId,
          schema: null,
          source: 'agent',
          values: {
            taskId: selectedTask.taskId,
          },
        };

        await this.tasks.trigger(ev);

        currentTask = selectedTask;
        suggestedTasks = [];
        skipResponse = true;
      }
    }

    let currentField: TaskFieldDto;
    if (currentTask) {
      currentField = await this.tasks.getCurrentField(
        currentTask.taskId,
        message.sessionId,
      );
    }

    return {
      cancelledTaskId,
      selectedTask,
      suggestedTasks,
      skipResponse,
      currentTask,
      currentField,
    };
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
                if (s.parameter === TOOL_CATCH_ALL_VALUE) {
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

  async retrieveCurrentTools(
    taskIntent: TaskIntentResult,
    message: DialogueMessageDto,
  ): Promise<IntentActiveTools> {
    const { currentTask, cancelledTaskId } = taskIntent;

    let matchOrRemoveTask = false;

    // load tools repositories
    const sessionRepositories = await this.tools.loadFromSession(message);
    let repositories: DialogueToolsRepositoryDto[] = [];

    if (currentTask) {
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
      this.logger.debug(`Using session tools`);
      repositories = sessionRepositories;
    }

    // // const skipChat = false;
    // if (currentTask && currentField) {
    //   this.logger.debug(`Current task field is ${currentField.name}`);
    //   // skipChat = currentField.required === true && !matchOrRemoveTask;
    //   // TODO enable fallback answer if no options matches
    // }

    // restore tools but filter out cancelled tools for a task, since removal is async and could have not been completed yet
    if (cancelledTaskId) {
      repositories = sessionRepositories.filter(
        (r) =>
          r.tools.filter(
            (t) =>
              (t.schema || []).filter(
                (s) => s.parameter === 'taskId' && s.value === cancelledTaskId,
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

    let hasCatchAll: AppToolsDTO;
    const matchCatchAll = tools.filter((t) => t.name === TOOL_CATCH_ALL);
    if (matchCatchAll.length) {
      hasCatchAll = matchCatchAll[0];
    }

    this.logger.debug(
      `Active tools: [${tools.map((t) => `${t.name}: ${t.description}`)}]`,
    );

    return {
      tools,
      repositories,
      isToolExclusive,
      matchOrRemoveTask,
      hasCatchAll,
    };
  }
}
