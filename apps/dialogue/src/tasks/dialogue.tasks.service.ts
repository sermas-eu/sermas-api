import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlatformAppDto } from 'apps/platform/src/app/platform.app.dto';
import { readYAML, uuidv4 } from 'libs/util';
import { DialogueToolsService } from '../tools/dialogue.tools.service';
import { ToolTriggerEventDto } from '../tools/trigger/dialogue.tools.trigger.dto';
import { DialogueTaskRecordService } from './record/dialogue.tasks.record.service';
import { DialogueTaskDto } from './store/dialogue.tasks.store.dto';
import { DialogueTaskStoreService } from './store/dialogue.tasks.store.service';

@Injectable()
export class DialogueTasksService implements OnModuleInit {
  private readonly logger = new Logger(DialogueTasksService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly store: DialogueTaskStoreService,
    private readonly records: DialogueTaskRecordService,
    private readonly tools: DialogueToolsService,
    private readonly emitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    if (this.config.get('IMPORT_TASKS') === '1') {
      await this.importFromFile('config/tasks.yaml');
    }
  }

  async trigger(ev: ToolTriggerEventDto) {
    this.emitter.emit('task.trigger', ev);
  }

  async importFromFile(filepath: string) {
    try {
      this.logger.debug(`Importing tasks from file=${filepath}`);
      const tasks = await readYAML<DialogueTaskDto[]>(filepath);
      if (tasks) await this.import(tasks);
    } catch (e) {
      this.logger.error(
        `Failed to import tasks from file=${filepath}: ${e.stack}`,
      );
    }
  }

  read(taskId: string) {
    return this.store.read(taskId, false);
  }

  add(task: DialogueTaskDto) {
    return this.save([task]);
  }

  async import(tasks: DialogueTaskDto[]) {
    await Promise.all(
      tasks.filter((t) => t.taskId).map((t) => this.store.remove(t.taskId)),
    );
    await this.save(tasks);
  }

  async save(tasks: DialogueTaskDto[]) {
    for (const [i, task] of Object.entries(tasks)) {
      if (!task.name) {
        this.logger.warn(`Missing task name for entry at pos:${i}`);
        continue;
      }

      if (!task.appId) {
        this.logger.warn(`Missing appId for '${task.name}'`);
        continue;
      }

      if (!task.taskId) {
        task.taskId = uuidv4();
      }

      task.fields = task.fields || [];

      if (task.fields.length) {
        for (const [f, field] of Object.entries(task.fields)) {
          field.order = +(field.order === undefined ? +f + 1 : field.order);
          field.type = field.type || 'text';
        }
        task.fields = task.fields.sort((a, b) =>
          a.order || 0 > b.order || 0 ? 1 : -1,
        );
      }

      this.logger.log(
        `Import task '${task.name}' taskId=${task.taskId || ''} (pos:${i})`,
      );

      if (task.options?.enableTool) {
        task.options = task.options || {};
        task.options.repositoryId =
          task.options?.repositoryId || task.sessionId || task.appId;
      }

      await this.store.save(task);

      // save as tool
      if (task.options?.enableTool) {
        const repositoryId = task.options?.repositoryId;
        this.logger.log(
          `Enabling taskId=${task.taskId} as tool with repositoryId=${repositoryId} sessionId=${task.sessionId || ''}`,
        );
        await this.tools.add({
          repositoryId,
          appId: task.appId,
          sessionId: task.sessionId || undefined,
          options: {
            triggerOnce: task.options?.toolOptions?.triggerOnce === true,
            exclusive: task.options?.toolOptions?.exclusive === true,
          },
          tools: [
            {
              name: task.name,
              description: task.description,
              skipResponse: true,
              schema: [
                {
                  type: 'string',
                  description: 'taskId',
                  parameter: 'taskId',
                  value: task.taskId,
                  ignore: true,
                },
              ],
            },
          ],
        });
      }
    }
  }

  list(appId: string) {
    return this.store.search({ appId, sessionId: undefined });
  }

  search(q) {
    return this.store.search(q);
  }

  async removeByApp(appId: string) {
    try {
      this.logger.debug(`Removing tasks for appId=${appId}`);
      const tasks = await this.search({ appId });
      for (const task of tasks) {
        await this.store.remove(task.taskId);
      }
    } catch (e) {
      this.logger.error(`Failed to remove task for appId=${appId}`);
    }
  }

  async remove(taskId: string) {
    await this.store.remove(taskId);
  }

  async importApp(app: PlatformAppDto) {
    if (app.tasks && app.tasks?.length) {
      try {
        this.logger.debug(`Importing tasks for appId=${app.appId}`);
        await this.import(
          app.tasks.map((task) => ({
            ...task,
            appId: app.appId,
          })),
        );
      } catch (e) {
        this.logger.error(
          `Tasks import failed for appId=${app.appId}: ${e.stack}`,
        );
      }
    }
  }

  async getCurrentRecord(sessionId: string) {
    const records = await this.records.search({
      sessionId,
      status: ['status', 'ongoing'],
    });

    if (!records.length) return null;

    return records[0];
  }

  async getCurrentTask(sessionId: string) {
    const record = await this.getCurrentRecord(sessionId);
    if (!record) return null;
    const task = await this.read(record.taskId);
    return task || null;
  }

  async getCurrentField(taskId: string, sessionId: string) {
    const records = await this.records.search({
      sessionId,
      taskId,
      status: ['status', 'ongoing'],
    });

    if (!records.length) return null;

    const record = records[0];
    const task = await this.read(record.taskId);

    for (const field of task.fields) {
      if (record.values[field.name] === undefined) return field;
    }

    return null;
  }
}
