import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  AppToolsDTO,
  PlatformAppChangedDto,
  ToolsParameterSchema,
} from 'apps/platform/src/app/platform.app.dto';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import {
  ButtonsContentDto,
  QuizContentDto,
  UIContentDto,
} from 'apps/ui/src/ui.content.dto';
import { UIInteractionDTO, UIInteractionEventDto } from 'apps/ui/src/ui.dto';
import { ToolParamType, ToolSchemaTypeList } from 'libs/llm/tools/tool.dto';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { hash, uuidv4 } from 'libs/util';
import { DialogueToolNotMatchingDto } from '../dialogue.chat.dto';
import { DialogueTaskChangedDto } from '../tasks/dialogue.tasks.dto';
import { DialogueToolTriggeredEventDto } from './dialogue.tools.dto';
import { DialogueToolsService } from './dialogue.tools.service';
import { ToolTriggerEventDto } from './trigger/dialogue.tools.trigger.dto';
import { DialogueToolsTriggerService } from './trigger/dialogue.tools.trigger.service';
import { extractToolValues } from './utils';

type UiToolParam = {
  description: string;
  schema?: ToolsParameterSchema[];
};

@Injectable()
export class DialogueToolsEventsService {
  private readonly logger = new Logger(DialogueToolsEventsService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly tools: DialogueToolsService,
    private readonly toolsTrigger: DialogueToolsTriggerService,
  ) {}

  @OnEvent('dialogue.tools.not_matching')
  toolNotFound(ev: DialogueToolNotMatchingDto) {
    this.tools.publishNotMatching(ev);
  }

  @OnEvent('task.changed')
  async onTaskChanged(ev: DialogueTaskChangedDto) {
    if (ev.operation !== 'deleted') return;
    if (!ev.record.options?.repositoryId) return;
    this.logger.debug(`Removing tools for deleted task ${ev.record.name}`);
    await this.tools.delete(ev.record.options.repositoryId);
  }

  @OnEvent('agent.tools.request')
  onAgentToolRequest(payload: DialogueToolTriggeredEventDto) {
    this.toolsTrigger.onAgentToolRequest(payload);
  }

  @OnEvent('dialogue.tool.trigger')
  async onTrigger(ev: ToolTriggerEventDto) {
    await this.toolsTrigger.onTrigger(ev);

    if (ev.repositoryId) {
      const repository = await this.tools.get(ev.repositoryId, false);
      if (repository) {
        if (repository.options?.triggerOnce === true) {
          await this.tools.delete(repository.repositoryId);
        }
      }
    }
  }

  @OnEvent('platform.app')
  async onAppChange(ev: PlatformAppChangedDto) {
    this.logger.debug(
      `Received app change operation=${ev.operation} appId=${ev.record.appId}`,
    );
    if (ev.operation === 'deleted') {
      await this.tools.delete(ev.record.appId);
    }
    if (ev.operation === 'updated' || ev.operation === 'created') {
      await this.tools.delete(ev.record.appId);
      await this.tools.set({
        repositoryId: ev.record.appId,
        appId: ev.record.appId,
        tools: ev.record.tools,
      });
    }
  }

  @OnEvent('session.changed')
  async onSessionChanged(ev: SessionChangedDto) {
    if (
      ev.operation === 'deleted' ||
      (ev.operation === 'updated' && ev.record.closedAt)
    ) {
      await this.tools.search(
        {
          appId: ev.appId,
          sessionId: ev.record.sessionId,
        },
        async (repository) => {
          this.logger.debug(
            `Removing repositoryId=${repository.repositoryId} for removed/expired sessionId=${ev.record.sessionId}`,
          );
          await this.tools.delete(repository.repositoryId);
        },
      );
    }
  }

  @OnEvent('ui.content')
  async addToolsContent(ev: UIContentDto) {
    const repositoryId = ev.metadata?.repositoryId || uuidv4();

    // console.warn(JSON.stringify(ev, null, 2));

    const resetTools = async () => {
      await this.tools.search(
        { sessionId: ev.sessionId, appId: ev.appId },
        async (r) => {
          await this.tools.delete(r.repositoryId);
        },
      );
    };

    const addTools = async (list: UiToolParam[]) => {
      await this.tools.add({
        repositoryId,
        appId: ev.appId,
        sessionId: ev.sessionId,
        options: {
          triggerOnce: true,
        },
        tools: list.map((param): AppToolsDTO => {
          this.logger.verbose(`Adding UI tool for '${param.description}'`);
          const schema: ToolsParameterSchema[] = [
            {
              description: 'selection',
              parameter: 'selection',
              type: 'string',
              value: param.description,
              ignore: true,
            },
          ];

          if (param.schema) {
            schema.push(...param.schema);
          }

          for (const key in ev.metadata || {}) {
            const type = (typeof ev.metadata[key]).toString();
            if (!(ToolSchemaTypeList as unknown as string[]).includes(type)) {
              this.logger.debug(
                `Skip metadata key=${key} of type=${type}. Must be one of ${ToolSchemaTypeList}`,
              );
              continue;
            }

            const metadataItemSchema: ToolsParameterSchema = {
              description: `internal: ${key}`,
              parameter: key,
              value: ev.metadata[key],
              type: type as ToolParamType,
              ignore: true,
            };
            // this.logger.debug(
            //   `Add metadata schema ${metadataItemSchema.parameter}=${metadataItemSchema.value}`,
            // );
            schema.push(metadataItemSchema);
          }

          return {
            returnDirect: true,
            description: param.description,
            skipResponse: true,
            name:
              'f' + hash([ev.appId, ev.sessionId, param.description].join('')),
            schema,
          };
        }),
      });
    };

    if (ev.options?.clearScreen) {
      await resetTools();
    }

    switch (ev.contentType) {
      case 'buttons':
        const buttons = ev.content as ButtonsContentDto;

        await addTools(
          buttons.list.map(
            (button): UiToolParam => ({
              description: `${button.description ? `${button.description} : ` : ''}${button.label || button.value}`,
              schema: [
                {
                  description: 'Ignore: btn value',
                  parameter: 'value',
                  type: 'string',
                  value: button.value,
                  ignore: true,
                },
              ],
            }),
          ),
        );
        break;
      case 'quiz':
        const quiz = ev.content as QuizContentDto;
        await addTools(
          quiz.answers.map((answer) => ({
            description: answer.answer,
            schema: [
              {
                description: 'Ignore: answerId',
                parameter: 'answerId',
                type: 'string',
                value: answer.answerId,
                ignore: true,
              },
            ],
          })),
        );
        break;
      case 'clear-screen':
        await resetTools();
        break;
    }
  }

  @Subscribe({
    topic: SermasTopics.ui.interaction,
  })
  async onUiInteraction(@Payload() payload: UIInteractionEventDto) {
    if (!payload.sessionId) return;
    // console.warn(JSON.stringify(payload, null, 2));

    const repositories = await this.tools.search({
      sessionId: payload.sessionId,
    });

    if (!repositories.length) {
      this.logger.warn(
        `onUiInteraction: No tools repository found for sessionId=${payload.sessionId}`,
      );
      return;
    }

    type ToolSelectionFilter = (schema: ToolsParameterSchema) => boolean;
    let selectionValue: ToolSelectionFilter = (schema) =>
      schema.parameter === 'value' &&
      schema.value === payload.interaction.value;
    if (payload.interaction.element === 'quiz') {
      selectionValue = (schema) =>
        schema.parameter === 'answerId' &&
        schema.value === payload.interaction.context.answerId;
    }

    const uiInteraction = payload.interaction as UIInteractionDTO;

    const filteredRepositories = repositories.filter(
      (r) =>
        (r.tools || []).filter(
          (tool) => (tool.schema || []).filter(selectionValue).length,
        ).length,
    );

    if (!filteredRepositories.length) return;

    const repository = filteredRepositories[0];

    const filteredTools = (repository.tools || []).filter(
      (tool) => (tool.schema || []).filter(selectionValue).length,
    );

    if (!filteredTools.length) return;

    const tool = filteredTools[0];

    this.logger.debug(
      `Triggering tool ${tool.name} on ${uiInteraction.element} interaction`,
    );

    const ev: ToolTriggerEventDto = {
      name: tool.name,
      schema: tool,
      values: {
        ...uiInteraction.context,
        ...extractToolValues(tool),
      },
      appId: payload.appId,
      sessionId: payload.sessionId,
      repositoryId: repository.repositoryId,
      source: 'ui',
    };

    this.emitter.emit('dialogue.tool.trigger', ev);
  }
}
