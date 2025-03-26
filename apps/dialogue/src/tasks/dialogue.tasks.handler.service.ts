import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { MonitorService } from 'libs/monitor/monitor.service';
import { uuidv4 } from 'libs/util';
import { DialogueToolNotMatchingDto } from '../dialogue.chat.dto';
import { DialogueMemoryService } from '../memory/dialogue.memory.service';
import { ToolTriggerEventDto } from '../tools/trigger/dialogue.tools.trigger.dto';
import { DialogueTasksAsyncApiService } from './dialogue.tasks.async.service';
import { DialogueTaskProgressDto } from './dialogue.tasks.dto';
import { ToolFieldValuesDto } from './dialogue.tasks.handler.dto';
import { DialogueTasksHandlerFieldsService } from './dialogue.tasks.handler.fields.service';
import { DialogueTasksService } from './dialogue.tasks.service';
import { DialogueTaskRecordDto } from './record/dialogue.tasks.record.dto';
import { DialogueTaskRecordService } from './record/dialogue.tasks.record.service';
import {
  DialogueTaskDto,
  TaskEventDto,
  TaskEventType,
  TaskFieldDto,
} from './store/dialogue.tasks.store.dto';
import { DialogueTaskStoreService } from './store/dialogue.tasks.store.service';

export const TOOL_CONTEXT_TASK_FIELD = 'task-field';
export const TOOL_CANCEL_TASK_NAME = 'cancel-current-activity';

@Injectable()
export class DialogueTasksHandlerService {
  private readonly logger = new Logger(DialogueTasksHandlerService.name);

  constructor(
    private readonly record: DialogueTaskRecordService,
    private readonly store: DialogueTaskStoreService,
    private readonly fieldHandler: DialogueTasksHandlerFieldsService,
    private readonly tasks: DialogueTasksService,
    private readonly emitter: EventEmitter2,
    private readonly async: DialogueTasksAsyncApiService,
    private readonly monitoring: MonitorService,
    private readonly memory: DialogueMemoryService,
  ) {}

  @OnEvent('dialogue.tools.not_matching')
  async toolNotFound(ev: DialogueToolNotMatchingDto) {
    if (!ev.currentTask) return;
    if (ev.currentTask.options?.matchOrRemove === true) return;
    if (!ev.currentField?.required) return;

    const records = await this.record.search({
      status: 'ongoing',
      taskId: ev.currentTask.taskId,
      sessionId: ev.sessionId,
    });

    if (!records || !records.length) return;

    const currentRecord = records.at(0);

    await this.fieldHandler.askForRequiredField({
      field: ev.currentField,
      task: ev.currentTask,
      record: currentRecord,
      context: {},
    });
  }

  @OnEvent('task.trigger')
  async onTaskTrigger(ev: ToolTriggerEventDto) {
    await this.handleTask(ev);
  }

  @OnEvent('task.progress')
  async onTaskFinished(ev: DialogueTaskProgressDto) {
    if (ev.type !== 'aborted' && ev.type !== 'completed') return;

    await this.fieldHandler.removeTaskTools(ev);
  }

  @OnEvent('task.progress')
  async onTaskCompleted(ev: DialogueTaskProgressDto) {
    if (ev.type !== 'completed') return;

    if (ev.task.options?.triggerOnce) {
      await this.tasks.remove(ev.task.taskId);
      if (ev.task.options?.removeRecord) {
        await this.record.remove(ev.record.recordId);
      } else {
        const record = await this.record.load(ev.record.recordId);
        if (record) {
          record.status = 'aborted';
          await record.save();
        }
      }
    }

    // clean up option to cancel task
    await this.fieldHandler.removeCancelTool(ev);
  }

  // @OnEvent('task.user-aborted')
  // async onTaskAbortedByUser(ev: {
  //   task: DialogueTaskDto;
  //   record: DialogueTaskRecordDto;
  // }) {
  //   // do nothing, the task default message is fine.
  //   return;

  //   const phrase = await this.fieldHandler.rephrase({
  //     record: ev.record,
  //     promptContext: [
  //       `CONTEXT:`,
  //       `User is interacting with you as a digital avatar and involved in an ongoing task.`,
  //       `The task is: ${ev.task.description}`,
  //       `The user wanted to cancel the ongoing task. Contextualize the task information in your answer.`,
  //       ``,
  //     ],
  //     label: 'Ok the activity has been cancelled.',
  //   });

  //   await this.fieldHandler.sendAgentMessage(
  //     { ...ev, field: undefined },
  //     phrase,
  //   );
  // }

  @OnEvent('task.progress')
  async onTaskStarted(ev: DialogueTaskProgressDto) {
    if (ev.type !== 'started') return;

    //NOTE: handled via intents
    // // add option to cancel task
    // if (!ev.task.options?.triggerOnce) {
    //   await this.fieldHandler.ensureCancelTaskTool(ev);
    // }
  }

  async cancelTask(ev: { taskId: string; sessionId: string }) {
    this.logger.debug(`Cancelling task ${ev.taskId}`);
    const task = await this.tasks.read(ev.taskId);
    if (!task) {
      this.logger.warn(
        `Cannot remove cancel option, task not found taskId=${ev.taskId}`,
      );
    }
    const record = await this.ensureRecord(ev.sessionId, task);
    await this.updateTaskProgress('aborted', task, record);
    this.emitter.emit('task.user-aborted', {
      record,
      task,
    });
  }

  async onToolTriggered(ev: ToolTriggerEventDto) {
    if (!ev.sessionId) return;

    if (ev.values?.context !== TOOL_CONTEXT_TASK_FIELD) {
      return;
    }
    this.logger.debug(
      `Tool context=${TOOL_CONTEXT_TASK_FIELD} set, execute task handler`,
    );

    if (ev.name === TOOL_CANCEL_TASK_NAME) {
      if (!ev.values?.taskId) {
        this.logger.warn(`Cannot remove cancel option, missing taskId`);
        return;
      }
      await this.cancelTask({
        sessionId: ev.sessionId,
        taskId: ev.values.taskId,
      });
      return;
    }

    if (ev.values?.field && ev.values?.recordId) {
      this.logger.debug(
        `Got tool field selection values=${JSON.stringify(ev.values)}`,
      );
      await this.handleFieldValue(ev);
      return;
    }

    await this.handleTask(ev);
  }

  private async ensureRecord(sessionId: string, task: DialogueTaskDto) {
    const recordQuery = {
      appId: task.appId,
      sessionId,
      taskId: task.taskId,
    };
    const records = await this.record.search(recordQuery);

    let record: DialogueTaskRecordDto = records.length ? records[0] : undefined;
    if (!record) {
      this.logger.debug(`Create new task record for sessionId=${sessionId}`);
      record = await this.record.save({
        ...recordQuery,
        recordId: uuidv4(),
        values: {},
        created: new Date(),
        updated: new Date(),
      });
    }

    return record;
  }

  async updateRecord(raw: DialogueTaskRecordDto) {
    if (!raw.taskId) throw new BadRequestException(`taskId missing`);
    if (!raw) throw new BadRequestException(`record missing`);
    if (!raw.sessionId) throw new BadRequestException(`sessionId missing`);

    this.logger.log(
      `Processing updated records sessionId=${raw.sessionId} appId=${raw.appId}`,
    );

    const task = await this.store.read(raw.taskId, true);
    let record = await this.ensureRecord(raw.sessionId, task);

    this.logger.debug(`Update record for taskId=${task.taskId}`);
    record.values = { ...(record.values || {}), ...(raw?.values || {}) };
    record = await this.record.save(record);

    await this.nextStep(record, task);
  }

  getTaskEvents(task: DialogueTaskDto, type: TaskEventType) {
    if (!task.events?.length) return [];
    return task.events.filter((e) => e.type === type);
  }

  async handleTaskEvents(context: {
    task: DialogueTaskDto;
    record: DialogueTaskRecordDto;
    events: TaskEventDto[];
  }) {
    for (const ev of context.events) {
      try {
        if (ev.condition) {
          const result = await this.fieldHandler.evaluateCondition({
            field: undefined,
            condition: ev.condition,
            record: context.record,
            task: context.task,
          });

          if (!result) {
            this.logger.debug(
              `Skip task event, ${ev.condition} evaluated false`,
            );
            continue;
          }
        }

        // send message
        if (ev.message) {
          const message = await this.fieldHandler.rephrase({
            record: context.record,
            label: ev.message,
          });
          await this.fieldHandler.sendAgentMessage(
            {
              ...context,
              field: null,
            },
            message,
          );
        }
        // trigger
        if (ev.trigger && ev.trigger.length) {
          for (const toolTrigger of ev.trigger) {
            if (!toolTrigger?.name) {
              this.logger.warn(
                `missing name in event tool trigger ${JSON.stringify(toolTrigger)}`,
              );
              continue;
            }

            if (toolTrigger.condition) {
              const result = await this.fieldHandler.evaluateCondition({
                field: undefined,
                condition: toolTrigger.condition,
                record: context.record,
                task: context.task,
              });

              if (!result) {
                this.logger.debug(
                  `Skip trigger for ${toolTrigger?.name}, condition ${toolTrigger.condition} evaluated false`,
                );
                continue;
              }
            }

            // handle form tool/tool-name or task/task-name
            const [type, name] = toolTrigger?.name.split('/');

            if (type.startsWith('task') && name) {
              this.logger.debug(`Trigger task ${toolTrigger.name}`);
              await this.handleTask({
                appId: context.task.appId,
                sessionId: context.record.sessionId,
                name,
                repositoryId: context.record.sessionId,
                schema: {
                  name,
                  description: '',
                },
                source: 'task',
                values: {
                  taskId: name,
                },
              });
              continue;
            }

            let toolName = toolTrigger.name;
            if (type.startsWith('tool') && name) {
              toolName = name;
            }

            this.logger.debug(`Trigger tool ${toolName}`);
            this.fieldHandler.triggerTool({
              name: toolName,
              ...context,
              toolTrigger,
            });
          }
        }
      } catch (e) {
        this.logger.error(
          `Error processing event ${ev.type} for ${context?.task?.name}: ${e.stack}`,
        );
      }
    }
  }

  async updateTaskProgress(
    type: TaskEventType,
    task: DialogueTaskDto,
    record: DialogueTaskRecordDto,
  ) {
    this.logger.debug(
      `Update task status ${record.status} -> ${type} task=${task.name}`,
    );

    if (
      record.status === type &&
      (type === 'completed' || type === 'aborted')
    ) {
      this.logger.debug(`Task status is already ${type}. Skip update`);
      return record;
    }

    // update record status
    record.status = type;
    record = await this.record.save(record);

    this.logger.debug(`Task updated status=${type} taskId=${task.taskId}`);

    const ev: DialogueTaskProgressDto = {
      type,
      task,
      record,
    };
    this.emitter.emit('task.progress', ev);
    await this.async.taskProgress(ev);

    const events = this.getTaskEvents(task, type);
    await this.handleTaskEvents({
      task,
      record,
      events,
    });

    return record;
  }

  async handleTask(ev: ToolTriggerEventDto) {
    let tasks = await this.store.search({
      appId: ev.appId,
      taskId: ev.values?.taskId,
    });

    if (!tasks.length) {
      tasks = await this.store.search({
        appId: ev.appId,
        name: ev.values?.taskId,
      });
    }

    if (!tasks.length) {
      this.logger.warn(
        `Task not found taskId=${ev.values?.taskId} appId=${ev.appId}`,
      );
      return;
    }

    try {
      const task = tasks[0];
      this.logger.verbose(`Task matches ${task.name}`);

      let record = await this.ensureRecord(ev.sessionId, task);

      const started = Object.values(record.values).length === 0;

      if (started) {
        record = await this.updateTaskProgress('started', task, record);
      }

      await this.nextStep(record, task);
    } catch (err) {
      this.logger.error(`handleTask error: ${err.stack}`);
    }
  }

  async handleFieldValue(ev: ToolTriggerEventDto) {
    const values = ev.values as ToolFieldValuesDto;

    const task = await this.store.read(values.taskId, false);
    if (!task) {
      this.logger.warn(`Task taskId=${values.taskId} not found`);
      return;
    }

    const filteredFields = task.fields.filter((f) => f.name === values.field);
    const field = filteredFields.length ? filteredFields[0] : null;

    if (!field) {
      this.logger.warn(`Task field field=${values.field} not found`);
      return;
    }

    let record = await this.ensureRecord(ev.sessionId, task);

    const validationResult = await this.fieldHandler.validate({
      task,
      record,
      field,
      values,
    });

    if (validationResult.error) {
      await this.fieldHandler.sendAgentMessage(
        {
          field,
          record,
          task,
        },
        validationResult.reason,
        validationResult.language,
      );
    } else {
      const value =
        validationResult.value !== undefined
          ? validationResult.value
          : values.val;

      record.values[values.field] = value;
      record = await this.record.save(record);
      this.logger.debug(`Saved record ${values.field}=${value}`);

      this.monitoring.log({
        label: 'task.saved',
        appId: record.appId,
        sessionId: record.sessionId,
      });
    }

    await this.nextStep(record, task);
  }

  async nextStep(record: DialogueTaskRecordDto, task: DialogueTaskDto) {
    let currentField: TaskFieldDto | undefined;

    const perf = this.monitoring.performance({
      appId: record.appId,
      sessionId: record.sessionId,
      label: 'task.handler',
    });

    const fields = task.fields.sort((a, b) =>
      a.order || 0 > b.order || 0 ? 1 : -1,
    );
    for (const field of fields) {
      this.logger.verbose(
        `Processing field ${field.name} order=${field.order || 0}`,
      );

      const hasValue = record.values[field.name] !== undefined;
      if (hasValue) {
        this.logger.verbose(`Field ${field.name} is set, skip`);
        continue;
      }

      currentField = field;

      // evaluate condition, if false skip the field
      if (currentField.condition) {
        perf('condition.check');
        const conditionMet = await this.fieldHandler.evaluateCondition({
          field: currentField,
          task,
          record,
        });
        perf('condition.completed');
        if (!conditionMet) {
          this.logger.debug(`Skipping field ${currentField.name}`);
          record.values[currentField.name] = null;
          record = await this.record.save(record);
          currentField = undefined;
          continue;
        }
      }

      if (currentField.type === 'eval') {
        perf('eval');

        const messages = await this.memory.getMessages(record.sessionId);

        // evaluate expression and set the value in the record
        this.logger.debug(`Evaluate field ${currentField.name}`);
        const value = await this.fieldHandler.evaluateExpression({
          field: currentField,
          task,
          record,
          context: {
            history: messages
              .map((m) => `${m.role}: ${m.content.replace('\n', ' ')}`)
              .join('\n'),
          },
        });

        // store value and emit
        record.values[currentField.name] = value;
        record = await this.record.save(record);
        this.logger.debug(
          `Saved evaluated record ${currentField.name}=${value}`,
        );

        perf('eval.completed');

        // reset current field
        currentField = undefined;
        continue;
      }

      break;
    }

    const completed =
      record.status === 'completed' ||
      (record.status === 'started' &&
        Object.keys(record.values).length === fields.length) ||
      (record.status === 'ongoing' &&
        (currentField === undefined ||
          (!currentField?.name && !currentField?.type))) ||
      fields.length === 0;

    this.logger.debug(
      `Task ${completed ? '' : 'not '}completed taskId=${task.taskId} sessionId=${record.sessionId}`,
    );

    if (completed) {
      record = await this.updateTaskProgress('completed', task, record);
      return;
    }

    this.logger.debug(
      `Current field name=${currentField?.name} type=${currentField?.type} taskId=${task.taskId} sessionId=${record.sessionId}`,
    );

    record = await this.updateTaskProgress('ongoing', task, record);
    try {
      await this.fieldHandler.handleField({
        field: currentField,
        task,
        record,
      });
    } catch (e) {
      this.logger.error(
        `Failed to handle field name=${currentField?.name}: ${e.message} taskId=${task.taskId} sessionId=${record.sessionId}`,
      );
      this.logger.debug(e.stack);
    }
    perf('field');
  }
}
