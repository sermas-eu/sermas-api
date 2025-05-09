import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ToolsParameterSchema } from 'apps/platform/src/app/platform.app.dto';
import { createSessionContext } from 'apps/session/src/session.context';
import { SessionService } from 'apps/session/src/session.service';
import {
  ButtonsContentDto,
  ButtonsUIContentDto,
  SupportedContentTypes,
  UIContentDto,
} from 'apps/ui/src/ui.content.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { getChunkId } from 'libs/sermas/sermas.utils';
import { uuidv4 } from 'libs/util';
import { ulid } from 'ulidx';
import {
  TOOL_CATCH_ALL,
  TOOL_CATCH_ALL_VALUE,
} from '../tools/dialogue.tools.dto';
import { DialogueToolsService } from '../tools/dialogue.tools.service';
import { ToolTriggerEventDto } from '../tools/trigger/dialogue.tools.trigger.dto';
import { DialogueTasksAsyncApiService } from './dialogue.tasks.async.service';
import { DialogueTaskProgressDto } from './dialogue.tasks.dto';
import {
  ToolFieldValuesDto,
  ValidationResultDto,
} from './dialogue.tasks.handler.dto';
import {
  taskFieldConditionPrompt,
  taskFieldExpressionPrompt,
  taskFieldRephrasePrompt,
  taskFieldValidationPrompt,
} from './dialogue.tasks.handler.fields.prompt';
import {
  TOOL_CANCEL_TASK_NAME,
  TOOL_CONTEXT_TASK_FIELD,
} from './dialogue.tasks.handler.service';
import { DialogueTaskRecordDto } from './record/dialogue.tasks.record.dto';
import {
  DialogueTaskDto,
  TaskEventTriggerDto,
  TaskFieldDto,
} from './store/dialogue.tasks.store.dto';

interface TaskFieldContext {
  task: DialogueTaskDto;
  record: DialogueTaskRecordDto;
  field: TaskFieldDto;
  context?: { [key: string]: string };
}

type TaskFieldValuesContext = TaskFieldContext & { values: ToolFieldValuesDto };

@Injectable()
export class DialogueTasksHandlerFieldsService {
  private readonly logger = new Logger(DialogueTasksHandlerFieldsService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly broker: MqttService,
    private readonly tools: DialogueToolsService,
    private readonly llm: LLMProviderService,
    private readonly session: SessionService,
    private readonly asyncApi: DialogueTasksAsyncApiService,

    private readonly monitor: MonitorService,
  ) {}

  async removeTaskTools(ev: DialogueTaskProgressDto) {
    const { appId, sessionId } = ev.record;

    const repositories = await this.tools.search({
      appId,
      sessionId,
      repositoryId: ev.record.recordId,
    });

    if (!repositories.length) return;

    for (const repository of repositories) {
      this.logger.debug(`Removing tool repository for task=${ev.task.taskId}`);
      await this.tools.delete(repository.repositoryId);
    }
  }

  async removeCancelTool(ev: DialogueTaskProgressDto) {
    const { appId, sessionId } = ev.record;

    const repositories = await this.tools.search({
      appId,
      sessionId,
    });

    const filtered = repositories
      .filter((r) =>
        (r.tools || []).filter(
          (t) =>
            t.name === TOOL_CANCEL_TASK_NAME &&
            (t.schema || []).filter(
              (s) => s.parameter === 'taskId' && s.value === ev.task.taskId,
            ),
        ),
      )
      .flat();

    if (!filtered.length) return;

    const repository = filtered[0];

    this.logger.debug(
      `Removed cancel option tool for taskId=${ev.task.taskId}`,
    );
    await this.tools.delete(repository.repositoryId);
  }

  async ensureCancelTaskTool(ev: DialogueTaskProgressDto) {
    const { appId, sessionId } = ev.record;

    const repositories = await this.tools.search({
      appId,
      sessionId,
    });

    const exists = repositories
      .filter((r) =>
        (r.tools || []).filter((t) => t.name === TOOL_CANCEL_TASK_NAME),
      )
      .flat();

    if (exists.length) return;

    await this.tools.add({
      appId,
      sessionId,
      repositoryId: uuidv4(),
      options: {
        triggerOnce: true,
      },
      tools: [
        {
          name: TOOL_CANCEL_TASK_NAME,
          description:
            'User explicitly indicates the intention to leave or cancel an ongoing task',
          schema: [
            {
              parameter: 'context',
              description: 'tool context',
              value: TOOL_CONTEXT_TASK_FIELD,
              type: 'string',
              ignore: true,
            },
            {
              parameter: 'taskId',
              description: 'cancel taskId',
              value: ev.task.taskId,
              type: 'string',
              ignore: true,
            },
          ],
        },
      ],
    });

    this.logger.debug(`Added cancel tool for taskId=${ev.task.taskId}`);
  }

  async triggerTool(context: {
    name: string;
    task: DialogueTaskDto;
    record: DialogueTaskRecordDto;
    toolTrigger: TaskEventTriggerDto;
  }) {
    if (!context.toolTrigger?.name) {
      this.logger.warn(
        `toolTrigger.name is empty for appId=${context.task.appId}`,
      );
      return;
    }

    const repositories = await this.tools.search({
      appId: context.record.appId,
    });

    for (const repository of repositories) {
      if (!repository.tools || !repository.tools.length) continue;
      // keep app level repo (repo id == appid) and session related ones
      if (
        repository.appId !== repository.repositoryId &&
        repository.sessionId !== context.record.sessionId
      ) {
        continue;
      }

      const filteredTools = repository.tools.filter(
        (t) => t.name === context.name,
      );
      if (!filteredTools.length) {
        this.logger.warn(
          `Tool ${context.toolTrigger.name} not found for appId=${context.task.appId}`,
        );
        continue;
      }

      const tool = filteredTools[0];

      const ev: ToolTriggerEventDto = {
        appId: context.record.appId,
        sessionId: context.record.sessionId,
        name: tool.name,
        schema: tool,
        values: context.toolTrigger.values || {},
        repositoryId: repository.repositoryId,
        source: 'task',
      };
      this.emitter.emit('dialogue.tool.trigger', ev);
      this.logger.debug(`Triggered tool name=${ev.name}`);
      break;
    }
  }

  async evaluateCondition(
    context: TaskFieldContext & { condition?: string; field?: TaskFieldDto },
  ) {
    const condition = context.condition || context.field?.condition;
    if (!condition) {
      this.logger.warn(`Condition is empty for taskId=${context.task.taskId}`);
      return true;
    }

    const perf = this.monitor.performance({
      ...context.record,
      label: 'task.evaluate-condition',
    });

    const llm = await this.session.getLLM(context.record.sessionId);
    const res = await this.llm.chat<{ result: boolean }>({
      ...this.llm.extractProviderName(llm?.tools),
      stream: false,
      json: true,
      user: taskFieldConditionPrompt({
        condition,
        values: JSON.stringify(context.record.values),
      }),
      tag: 'tools',
      sessionContext: createSessionContext(context.record),
    });

    perf();

    return res?.result ? res.result === true : null;
  }

  invokeHandler(context: TaskFieldContext) {
    return this.asyncApi.fieldHandler({
      appId: context.record.appId,
      sessionId: context.record.sessionId,
      recordId: context.record.recordId,
      taskId: context.record.taskId,
      field: context.field,
    });
  }

  async evaluateExpression(context: TaskFieldContext) {
    let fieldPrompt = context.field.prompt;
    if (context.context) {
      for (const key in context.context) {
        fieldPrompt = fieldPrompt.replace(`{${key}}`, context.context[key]);
      }
    }

    try {
      const perf = this.monitor.performance({
        ...context.record,
        label: 'task.evaluate-expression',
      });

      const res = await this.llm.chat<{ result: boolean }>({
        stream: false,
        json: true,
        user: taskFieldExpressionPrompt({
          fieldPrompt,
          values: JSON.stringify(context.record.values),
        }),
        tag: 'tools',
        sessionContext: createSessionContext(context.record),
      });

      perf();

      const value = res?.result ? res.result : null;
      this.logger.debug(
        `Expression eval value=${value} raw=${JSON.stringify(res)}`,
      );
      return value;
    } catch (e) {
      this.logger.error(`Expression eval failed: ${e.stack}`);
      return null;
    }
  }

  replaceValues(text: string, record?: Record<string, any>) {
    record = record || {};
    let value = text;
    for (const key in record) {
      value = value.replace(new RegExp(`\{${key}\}`, 'ig'), record[key]);
    }
    return value;
  }

  async validate(
    context: TaskFieldValuesContext,
  ): Promise<ValidationResultDto> {
    const { field, values } = context;

    // allow empty values for non required field
    if (!field.required && values.value === null)
      return { error: false, value: null };

    const language = await this.session.getLanguage(context.record);

    let rules = '';
    switch (field.type) {
      case 'boolean':
        rules = `Convert to true or false.`;
        break;
      case 'text':
        rules = `Any text is valid. Should not be empty.`;
        break;
      case 'date':
        rules = `Ensure date is valid then convert to javascript Date format.`;
        break;
      case 'select':
        if (field.options?.length) {
          const options = JSON.stringify(field.options || []);
          rules = `
Find a match of 'value' with one of the following options:

${options}

Return the matching 'value' field from options`;
        }
        break;
      default:
        // skip validation for unknown fields
        if (!field.validation) return { error: false, value: values.value };
        break;
    }

    const perf = this.monitor.performance({
      ...context.record,
      label: 'task.validation',
    });

    const prompt = taskFieldValidationPrompt({
      field,
      rules,
      language,
      value: values.value,
    });

    type ValidationResponse = { value: any | null; reason?: string };
    const res = await this.llm.chat<ValidationResponse>({
      stream: false,
      json: true,
      system: this.replaceValues(prompt, {
        [values.field]: values.value,
      }),
      tag: 'tools',
      sessionContext: createSessionContext(context.record),
    });

    perf();

    this.logger.debug(`validation response: ${JSON.stringify(res)}`);

    if (res) {
      if (res.value === null) {
        this.logger.warn(
          `Validation failed for ${values.field}=${values.value}: ${res.reason}`,
        );
        return { error: true, ...res };
      } else {
        this.logger.debug(`Field ${values.field} is valid`);
        return { error: false, ...res };
      }
    }

    return {
      error: true,
      reason: 'There has been an internal error, please retry',
    };
  }

  async rephrase(context: {
    record: DialogueTaskRecordDto;
    label: string;
    basePrompt?: string;
  }) {
    const language = await this.session.getLanguage(context.record);

    const prompt = taskFieldRephrasePrompt({
      basePrompt: context.basePrompt || '',
      language,
    });

    return await this.llm.chat({
      stream: false,
      json: false,
      system: prompt,
      user: context.label,
      tag: 'translation',
      sessionContext: createSessionContext(context.record),
    });
  }

  async handleField(context: TaskFieldContext) {
    const perf = this.monitor.performance({
      ...context.record,
      label: 'task.handle-field',
    });

    if (!context.field) {
      this.logger.warn(`Field is empty, task=${context.task.name}`);
      return;
    }

    let label = context.field?.label;
    if (label) {
      Object.keys(context.record?.values || {}).forEach((k) => {
        let val = context.record.values[k] || '';
        if (context.field.type === 'select' && context.field.options?.length) {
          const filteredOptions = context.field.options.filter(
            (o) => val === o.value,
          );
          if (filteredOptions?.length) {
            val = filteredOptions[0].label || val;
          }
        }
        label = this.replaceValues(label, { [k]: val });
      });

      label = await this.rephrase({
        ...context,
        label,
      });
    }

    switch (context?.field?.type) {
      case 'external':
        if (context.field.type === 'external') {
          this.logger.debug(
            `Using external handler field=${context.field.name} handler=${context.field.handler}`,
          );
          await this.invokeHandler({
            field: context.field,
            task: context.task,
            record: context.record,
          });
          break;
        }
        break;
      case 'boolean':
        this.sendUiContent(
          this.createContent<ButtonsContentDto>(context, 'buttons', {
            label,
            list: (context.field.options || []).map((o) => ({
              label: o.label || o.value,
              value: o.value,
              description:
                o.description ||
                `Expect a boolean anwser from the user (such as yes, ok or no, cancel). Match ${o.label || o.value}`,
              options: {
                ttsEnabled: false,
              },
            })),
          }),
        );
        break;
      case 'text':
        this.tools.add({
          appId: context.record.appId,
          sessionId: context.record.sessionId,
          repositoryId: context.record.recordId,
          tools: [
            {
              name: TOOL_CATCH_ALL,
              description: `Collects the complete USER message`,
              schema: [
                {
                  parameter: TOOL_CATCH_ALL_VALUE,
                  description: 'user input value',
                  type: 'string',
                },
                ...this.createToolMetadataParameters(context),
              ],
            },
          ],
          options: {
            triggerOnce: true,
            exclusive: true,
          },
        });
        this.sendAgentMessage(context, label);
        break;
      case 'date':
        this.tools.add({
          appId: context.record.appId,
          sessionId: context.record.sessionId,
          repositoryId: context.record.recordId,
          tools: [
            {
              name: TOOL_CATCH_ALL,
              description: `Collects the complete USER message for field ${context.field.name}`,
              schema: [
                {
                  parameter: TOOL_CATCH_ALL_VALUE,
                  description: 'user input value',
                  type: 'string',
                },
                ...this.createToolMetadataParameters(context),
              ],
            },
          ],
          options: {
            triggerOnce: true,
            exclusive: true,
          },
        });
        this.sendAgentMessage(context, label);
        break;
      case 'select':
        this.sendUiContent(
          this.createContent<ButtonsContentDto>(context, 'buttons', {
            label,
            list: (context.field.options || []).map((o) => ({
              label: o.label || o.value,
              value: o.value,
              description: o.description,
              options: {
                ttsEnabled: false,
              },
            })),
          }),
        );
        break;
    }

    perf(context.field?.type);
  }

  createMetadata(context: TaskFieldContext): Record<string, any> {
    return {
      repositoryId: context.record.recordId,
      field: context.field.name,
      taskId: context.record.taskId,
      recordId: context.record.recordId,
      context: TOOL_CONTEXT_TASK_FIELD,
    };
  }

  createToolMetadataParameters(
    context: TaskFieldContext,
  ): ToolsParameterSchema[] {
    const metadata = this.createMetadata(context);
    return Object.keys(metadata).map((parameter) => {
      const value = metadata[parameter];
      return {
        parameter,
        value,
        type: 'string',
        ignore: true,
      } as ToolsParameterSchema;
    });
  }

  createContent<T = UIContentDto<any>>(
    context: TaskFieldContext,
    contentType: SupportedContentTypes,
    content: T,
  ): UIContentDto<T> {
    return {
      appId: context.record.appId,
      sessionId: context.record.sessionId,
      contentType,
      content,
      metadata: this.createMetadata(context),
      options: context.field?.uiOptions || {},
    } as UIContentDto<T>;
  }

  async askForRequiredField(context: TaskFieldContext) {
    let text = '';
    switch (context.field.type) {
      case 'boolean':
      case 'select':
        text = await this.rephrase({
          label:
            'Please select one of the available options. You can also ask to cancel this activity.',
          record: context.record,
        });

        break;
      default:
        return;
    }

    if (!text) return;

    this.logger.debug(
      `Value not matching for field name=${context.field.name} sessionId=${context.record.sessionId}`,
    );

    await this.sendAgentMessage(context, text);
  }

  async sendAgentMessage(
    context: TaskFieldContext,
    text: string,
    language?: string,
  ) {
    if (!language) {
      language = await this.session.getLanguage(context.record);
    }

    const ev: DialogueMessageDto = {
      actor: 'agent',
      appId: context.record.appId,
      sessionId: context.record.sessionId,
      language,
      text,
      messageId: getChunkId(),
      requestId: ulid(),
      ts: new Date(),
    };

    // TODO : emitter handler also send the TTS for some reason
    // this.broker.publish(SermasTopics.dialogue.messages, ev);
    this.emitter.emit('dialogue.chat.message', ev);
  }

  async sendUiContent(content: ButtonsUIContentDto);
  async sendUiContent(content: UIContentDto) {
    content.requestId = content.requestId || ulid();

    content.options = content.options || {};
    content.options.ttsEnabled = true;

    return await this.broker.publish(SermasTopics.ui.content, content);
  }
}
