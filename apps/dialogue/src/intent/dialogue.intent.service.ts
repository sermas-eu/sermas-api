import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { DialogueMemoryService } from 'apps/dialogue/src/memory/dialogue.memory.service';
import { DialogueTasksService } from 'apps/dialogue/src/tasks/dialogue.tasks.service';
import { ToolTriggerEventDto } from 'apps/dialogue/src/tools/trigger/dialogue.tools.trigger.dto';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { SessionService } from 'apps/session/src/session.service';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { uuidv4 } from 'libs/util';
import { DialogueMemoryMessageDto } from '../memory/dialogue.memory.dto';
import {
  DialogueTaskChangedDto,
  DialogueTaskProgressDto,
} from '../tasks/dialogue.tasks.dto';
import { DialogueTaskRecordService } from '../tasks/record/dialogue.tasks.record.service';
import { DialogueTaskDto } from '../tasks/store/dialogue.tasks.store.dto';

const ANSWER_TIMEOUT = 1500;

type TaskQuestionWrapper = {
  ts: Date;
  taskId: string;
  question: string;
  continue: string;
  cancel: string;
  sessionId: string;
  intent?: string;
  appId: string;
  language?: string;
  triggered?: Date;
  direct: boolean;
  askTaskId?: string;
  askTaskName?: string;
};

type TaskIntentMatch = {
  result: TaskQuestionWrapper;
  matches: DialogueTaskDto[];
};

type PrompIntent = {
  taskId?: string;
  taskDescription: string;
  description: string;
  name: string;
};

@Injectable()
export class DialogueIntentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DialogueIntentService.name);

  private cache: {
    [sessionId: string]: TaskQuestionWrapper;
  } = {};

  constructor(
    private readonly platformApp: PlatformAppService,
    private readonly session: SessionService,
    private readonly llm: LLMProviderService,

    private readonly memory: DialogueMemoryService,
    private readonly tasks: DialogueTasksService,
    private readonly taskRecords: DialogueTaskRecordService,

    private readonly monitor: MonitorService,
  ) {}

  @OnEvent('task.progress')
  async onTaskCompleted(ev: DialogueTaskProgressDto) {
    if (
      ev.type === 'completed' ||
      ev.type === 'aborted'
      // && ev.task.options?.triggerOnce
    ) {
      if (ev.record?.sessionId && this.cache[ev.record?.sessionId]) {
        this.logger.debug(
          `Remove intent task cache for sessionId=${ev.record?.sessionId}`,
        );
        delete this.cache[ev.record?.sessionId];
      }
    }
  }

  @OnEvent('task.changed')
  // if a task is removed, remove from the cache
  // applies for matchOrRemove options when offering
  // a confirmation to the user
  async removeCachedTask(ev: DialogueTaskChangedDto) {
    if (!ev.record?.sessionId) return;
    if (ev.operation !== 'deleted') return;

    const cached = this.cache[ev.record?.sessionId];
    if (!cached) return;
    if (
      cached.taskId !== ev.record.taskId &&
      cached.askTaskId !== ev.record.taskId
    )
      return;

    this.logger.debug(
      `Removing intent cache for sessionId=${ev.record?.sessionId}`,
    );
    delete this.cache[ev.record?.sessionId];
  }

  @Interval(ANSWER_TIMEOUT)
  async cleanup() {
    for (const sessionId in this.cache) {
      if (this.cache[sessionId].ts.getTime() + ANSWER_TIMEOUT > Date.now())
        continue;

      // skip if triggered
      if (this.cache[sessionId].triggered) continue;

      const { taskId, question } = this.cache[sessionId];

      this.logger.debug(
        `Send task offering sessionId=${sessionId} taskId=${taskId}: ${question}`,
      );

      this.cache[sessionId].triggered = new Date();

      const askTaskName =
        'ask-for-' + (this.cache[sessionId].intent || 'intent');

      const propose = await this.shouldProposeTask(
        this.cache[sessionId],
        askTaskName,
      );
      if (!propose) {
        this.logger.debug(
          `Skip task offering, exists taskId=${this.cache[sessionId].taskId}`,
        );
        continue;
      }

      // const record = this.cache[sessionId];
      try {
        // // trigger directly if there is a direct match
        // if (record.direct) {
        //   const ev: ToolTriggerEventDto = {
        //     appId: record.appId,
        //     name: record.taskId,
        //     repositoryId: record.taskId,
        //     sessionId: record.sessionId,
        //     schema: null,
        //     source: 'agent',
        //     values: {
        //       taskId: record.taskId,
        //     },
        //   };
        //   await this.tasks.trigger(ev);
        // } else {
        await this.askTaskConfirmation(this.cache[sessionId]);
        // }
      } catch (e: any) {
        this.logger.warn(`askTaskConfirmation: ${e.stack}`);
      }
    }
  }

  onModuleInit() {
    this.cache = {};
  }

  onModuleDestroy() {
    this.cache = {};
  }

  // decide if showing the task proposition is needed
  async shouldProposeTask(op: TaskQuestionWrapper, askTaskName: string) {
    const tasks = await this.tasks.search({
      appId: op.appId,
      sessionId: op.sessionId,
    });

    // check if a task is already ongoing
    const ongoingTaskRecords = await this.taskRecords.search({
      appId: op.appId,
      sessionId: op.sessionId,
      taskId: op.taskId,
      status: ['started', 'ongoing'],
    });

    // found an open task, skip offering
    if (ongoingTaskRecords.length) {
      this.logger.debug(
        `A task is ongoing, skip offering name=${askTaskName} sessionId=${op.sessionId} appId=${op.appId}`,
      );
      return false;
    }

    // check if a task has been completed in the session
    const completedTaskRecords = await this.taskRecords.search({
      appId: op.appId,
      sessionId: op.sessionId,
      taskId: op.taskId,
      status: ['completed'],
    });

    // found a completed task, skip offering
    if (completedTaskRecords.length) {
      for (const completedTaskRecord of completedTaskRecords) {
        const task = await this.tasks.read(completedTaskRecord.taskId);
        if (!task) continue;
        if (task.options?.oncePerSession !== true) continue;
        // TODO check if the context has changed, so doing again the same task may be required
        this.logger.debug(
          `Task can be completed only once (options oncePerSession is set). Skip offering name=${askTaskName} sessionId=${op.sessionId} appId=${op.appId}`,
        );
        return false;
      }
    }

    // check if the proposal has already been sent
    const matches = tasks.filter((t) => t.name === askTaskName);
    if (!matches.length) {
      this.logger.debug(
        `Task has not been already proposed name=${askTaskName} sessionId=${op.sessionId} appId=${op.appId}`,
      );
      return true;
    }

    const askTask = matches[0];

    // check if the proposal sent has been answered
    const records = await this.taskRecords.search({
      appId: op.appId,
      sessionId: op.sessionId,
      taskId: askTask.taskId,
      status: ['started', 'ongoing'],
    });

    if (records.length) {
      this.logger.debug(
        `Task proposition is ongoing name=${askTaskName} sessionId=${op.sessionId} appId=${op.appId}`,
      );
      return false;
    }

    return true;
  }

  async askTaskConfirmation(op: TaskQuestionWrapper) {
    const askTaskId = uuidv4();
    const askTaskName = 'ask-for-' + (op.intent || 'intent');

    const propose = await this.shouldProposeTask(op, askTaskName);
    if (!propose) {
      this.logger.debug(`Skip task offering, exists taskId=${op.taskId}`);
      return;
    }

    this.logger.log(
      `Proposing task name=${askTaskName} sessionId=${op.sessionId} appId=${op.appId}`,
    );

    await this.tasks.add({
      appId: op.appId,
      sessionId: op.sessionId,
      taskId: askTaskId,
      name: askTaskName,
      description: `User want to confirm the continuation of a task ${op.intent || ''}`,
      options: {
        triggerOnce: true,
        enableTool: false,
        matchOrRemove: true,
      },
      events: [
        {
          type: 'completed',
          trigger: [
            {
              name: `task/${op.taskId}`,
              values: op,
              condition: `{confirm} == ${op.continue}`,
            },
          ],
        },
      ],
      fields: [
        {
          name: 'confirm',
          type: 'select',
          label: op.question,
          required: true,
          options: [
            {
              label: op.continue,
              value: op.continue,
              description:
                'Extract user intention to confirm an action (such as continue, ok, yes, done)',
            },
            {
              label: op.cancel,
              value: op.cancel,
              description:
                'Extract user intention to cancel an action (such as cancel, no, wait)',
            },
          ],
        },
      ],
    });

    // update cache references
    op.askTaskId = askTaskId;
    op.askTaskName = askTaskName;

    const ev: ToolTriggerEventDto = {
      appId: op.appId,
      name: askTaskName,
      repositoryId: askTaskId,
      sessionId: op.sessionId,
      schema: null,
      source: 'agent',
      values: {
        taskId: askTaskId,
      },
    };
    await this.tasks.trigger(ev);
  }

  async getIntents(appId: string) {
    const tasks = await this.tasks.search({
      appId,
    });
    if (!tasks) return [];

    const intents: PrompIntent[] = tasks
      .filter((t) => t.intents && t.intents.length)
      .map((t) => {
        return t.intents.map(
          (i): PrompIntent => ({
            taskId: t.taskId,
            taskDescription: t.description,
            description: i.description,
            name: i.name,
          }),
        );
      })
      .flat();

    if (!intents.length) return [];

    return intents;
  }

  async matchOnEvent(ev: DialogueMessageDto) {
    const res = await this.match(ev);

    if (!res) return;

    this.logger.debug(`Cached taskId=${res.result.taskId}`);
    this.cache[ev.sessionId] = {
      sessionId: ev.sessionId,
      appId: ev.appId,
      ts: new Date(),
      taskId: res.result.taskId,
      question: res.result.question,
      continue: res.result.continue,
      cancel: res.result.cancel,
      language: ev.language,
      intent: res.result?.intent,
      direct: res.result?.direct,
    };
  }

  async match(ev: {
    sessionId: string;
    appId: string;
    language?: string;
  }): Promise<TaskIntentMatch | null> {
    if (this.cache[ev.sessionId] && this.cache[ev.sessionId].triggered)
      return null;

    const currentRecord = await this.tasks.getCurrentRecord(ev.sessionId);
    if (currentRecord) {
      const currentTask = await this.tasks.getCurrentTask(ev.sessionId);
      this.logger.debug(
        `Skip intent detecion during an ongoing task ${currentTask ? 'name=' + currentTask.name : ''}`,
      );
      return null;
    }

    const messages: DialogueMemoryMessageDto[] = [];
    const allMessages = await this.memory.getMessages(ev.sessionId);
    if (!allMessages.length) return null;

    // drop older message, remove those part of a task

    let taskStatus: string = undefined;
    for (const message of allMessages) {
      if (message.type === 'task') {
        taskStatus = message.metadata?.status;
        if (taskStatus === 'closed' || taskStatus === 'aborted')
          taskStatus = undefined;
      }

      if (taskStatus !== 'started') {
        messages.push(message);
      }
    }

    const history = messages
      // .filter((m) => m.role === 'user')
      .map((m) => `${m.role}: ${m.content.replace('\n', ' ')}`);

    if (history.length < 2) return;

    const app = await this.platformApp.readApp(ev.appId, false);
    if (!app) return null;

    const avatar = await this.session.getAvatar(ev);

    const appPrompt = app.settings?.prompt?.text || '';

    const prompt: string[] = [];

    if (appPrompt) {
      prompt.push(`The application scope is: ${appPrompt}`);
    }

    if (avatar && avatar.prompt) {
      prompt.push(`You are a digital agent: ${avatar.prompt}`);
    }

    const tasks = await this.tasks.search({
      appId: ev.appId,
    });
    if (!tasks) return null;

    const intents = await this.getIntents(ev.appId);
    if (!intents.length) return null;

    const sessionLanguage = await this.session.getLanguage(ev, false);
    const language = ev.language || sessionLanguage;

    prompt.push(
      `Analyze user interaction in HISTORY and match one of TASKS.',
      'Return 'null' in those cases:`,
      '1. If there is no match',
      '2. if the assistant explicitly asked for a task in the last two interactions',
      '3. if the user confirmed a task in the last interaction',
      '4. if the assistant provided an answer for the task',
      `Find a matching task from the discussion with the user.`,
      `Answer asking a confirmation based on taskDescription but adapted to the discussion in a short form. Add labels for Continue and Cancel options.`,
      language ? `Use language ${language}` : '',
      `Return a parsable JSON object with structure { result: { taskId: string, intent: "exact name of matching intent", direct: boolean, question: "question about task description", cancel: 'label', continue: 'label' } }`,
      'Never add notes or explanations',
      `TASKS:\n${intents.map((i) => JSON.stringify(i)).join('\n')}`,
      `HISTORY: \n${history.join('\n')}`,
    );

    const perf = this.monitor.performance({
      ...ev,
      label: 'intent.text',
    });

    const llm = await this.session.getLLM(ev.sessionId);

    const res = await this.llm.chat<TaskIntentMatch>({
      ...this.llm.extractProviderName(llm?.intent),
      stream: false,
      json: true,
      message: prompt.join('\n'),
      tag: 'intent',
    });

    perf();

    if (res?.result && res?.result.taskId) {
      const matches = tasks.filter((t) => t.taskId === res.result.taskId);
      if (!matches.length) return;

      res.matches = matches;
      return res;
    }

    this.logger.debug(`Intent not found for sessionId=${ev.sessionId}`);
    return null;
  }
}
