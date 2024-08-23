import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PlatformAppChangedDto } from 'apps/platform/src/app/platform.app.dto';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { DialogueToolsService } from '../tools/dialogue.tools.service';
import { ToolTriggerEventDto } from '../tools/trigger/dialogue.tools.trigger.dto';
import { DialogueTaskRecordChangedDto } from './dialogue.tasks.dto';
import { DialogueTasksHandlerService } from './dialogue.tasks.handler.service';
import { DialogueTasksService } from './dialogue.tasks.service';
import { DialogueTaskRecordService } from './record/dialogue.tasks.record.service';

@Injectable()
export class DialogueTasksEventsService {
  private readonly logger = new Logger(DialogueTasksEventsService.name);

  constructor(
    private readonly handler: DialogueTasksHandlerService,
    private readonly tasks: DialogueTasksService,
    private readonly record: DialogueTaskRecordService,
    private readonly tools: DialogueToolsService,
  ) {}

  @OnEvent('task.record.changed')
  async onTaskRecodChanged(ev: DialogueTaskRecordChangedDto) {
    if (!ev.record?.status) return;
    if (ev.record.status !== 'completed' && ev.record.status !== 'aborted')
      return;

    const task = await this.tasks.read(ev.record.taskId);
    if (!task) return;

    if (!task.options?.repositoryId) return;

    this.logger.debug(
      `Removing tools for closed record taskId=${ev.record.taskId}`,
    );

    await this.tools.delete(task.options.repositoryId);
  }

  @OnEvent('dialogue.tool.trigger')
  async onTrigger(ev: ToolTriggerEventDto) {
    this.handler.onToolTriggered(ev);
  }

  @Subscribe({
    topic: SermasTopics.platform.appChanged,
  })
  async onAppChanged(@Payload() payload: PlatformAppChangedDto) {
    switch (payload.operation) {
      case 'created':
      case 'updated':
        const app = payload.record;
        await this.tasks.removeByApp(payload.appId);
        await this.tasks.importApp(app);
        break;
      case 'deleted':
        await this.tasks.removeByApp(payload.appId);
        break;
    }
  }

  @Subscribe({
    topic: SermasTopics.session.sessionChanged,
  })
  // abort all ongoing records for a closed session
  async onSessionChanged(@Payload() payload: SessionChangedDto) {
    if (payload.operation !== 'updated') return;
    if (!payload.record?.sessionId) return;

    // only if closed
    if (!payload.record?.closedAt) return;

    const records = await this.record.search({
      sessionId: payload.record.sessionId,
    });

    for (const record of records) {
      record.status = 'aborted';
      await this.record.save(record);
    }
  }
}
