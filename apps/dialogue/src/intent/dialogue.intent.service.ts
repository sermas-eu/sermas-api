import { Injectable, Logger } from '@nestjs/common';
import { DialogueMemoryService } from 'apps/dialogue/src/memory/dialogue.memory.service';
import { DialogueTasksService } from 'apps/dialogue/src/tasks/dialogue.tasks.service';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { SessionService } from 'apps/session/src/session.service';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { DialogueMemoryMessageDto } from '../memory/dialogue.memory.dto';
import { DialogueTaskRecordDto } from '../tasks/record/dialogue.tasks.record.dto';
import { DialogueTaskRecordService } from '../tasks/record/dialogue.tasks.record.service';
import { DialogueTaskDto } from '../tasks/store/dialogue.tasks.store.dto';
import { intentPrompt } from './dialogue.intent.prompt';
import { createSessionContext } from 'apps/session/src/session.context';

type TaskQuestionWrapper = {
  taskId: string;
  trigger: boolean;
  match: boolean;
  cancel: boolean;
};

type TaskIntentMatch = {
  result: TaskQuestionWrapper;
  task: DialogueTaskDto;
  record?: DialogueTaskRecordDto;
};

type PrompIntent = {
  taskId?: string;
  taskDescription: string;
  description: string;
  name: string;
};

@Injectable()
export class DialogueIntentService {
  private readonly logger = new Logger(DialogueIntentService.name);

  constructor(
    private readonly platformApp: PlatformAppService,
    private readonly session: SessionService,
    private readonly llm: LLMProviderService,

    private readonly memory: DialogueMemoryService,
    private readonly tasks: DialogueTasksService,
    private readonly taskRecords: DialogueTaskRecordService,

    private readonly monitor: MonitorService,
  ) {}

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

  async match(ev: {
    sessionId: string;
    appId: string;
    language?: string;
  }): Promise<TaskIntentMatch | null> {
    const currentRecord = await this.tasks.getCurrentRecord(ev.sessionId);
    let currentTask: DialogueTaskDto;

    if (currentRecord) {
      currentTask = await this.tasks.getCurrentTask(ev.sessionId);
      this.logger.debug(
        `There is an ongoing task ${currentTask ? 'name=' + currentTask.name : ''}`,
      );
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
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `${m.role}: ${m.content.replace('\n', ' ')}`);

    if (history.length < 2) return;

    const settings = await this.session.getSettings(ev);
    const avatar = await this.session.getAvatar(ev);

    const tasks = await this.tasks.search({
      appId: ev.appId,
    });
    if (!tasks) return null;

    const intents = await this.getIntents(ev.appId);
    if (!intents.length) return null;

    const perf = this.monitor.performance({
      ...ev,
      label: 'intent.text',
    });

    const llm = await this.session.getLLM(ev.sessionId);

    const res = await this.llm.chat<TaskIntentMatch>({
      ...this.llm.extractProviderName(llm?.intent),
      stream: false,
      json: true,
      user: intentPrompt({
        settings,
        avatar,
        history: history.join('\n'),
        intents: JSON.stringify(intents),
        currentTask: currentTask?.name,
      }),
      tag: 'intent',
      sessionContext: createSessionContext(ev),
    });

    perf();

    if (res?.result) {
      if (!currentTask) {
        const matches = tasks.filter((t) => t.taskId === res.result.taskId);
        if (!matches.length) return;
        res.task = matches[0];
      } else {
        res.task = currentTask;
      }

      if (currentRecord) {
        res.record = currentRecord;
      }

      return res;
    }

    this.logger.debug(`Intent not found for sessionId=${ev.sessionId}`);
    return null;
  }
}
