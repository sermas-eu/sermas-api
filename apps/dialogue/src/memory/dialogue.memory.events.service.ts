import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { UIContentDto } from 'apps/ui/src/ui.content.dto';
import { uiContentToText } from 'apps/ui/src/util';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { DialogueTaskProgressDto } from '../tasks/dialogue.tasks.dto';
import { ToolTriggerEventDto } from '../tools/trigger/dialogue.tools.trigger.dto';
import { DialogueMemoryMessageDto } from './dialogue.memory.dto';
import { DialogueMemoryService } from './dialogue.memory.service';

@Injectable()
export class DialogueMemoryEventsService {
  private readonly logger = new Logger(DialogueMemoryEventsService.name);

  constructor(
    private readonly app: PlatformAppService,
    private readonly memory: DialogueMemoryService,
  ) {}

  async saveMessages(sessionId: string, messages: DialogueMemoryMessageDto[]) {
    try {
      await this.memory.addMessages(sessionId, messages);
    } catch (e) {
      this.logger.error(`Failed to update history: ${e.stack}`);
    }
  }

  @OnEvent('dialogue.tool.trigger')
  async onUiToolTrigger(ev: ToolTriggerEventDto) {
    if (!ev.sessionId) return;
    // handle only UI interactions. messages are already part of the chat
    if (ev.source !== 'ui') return;

    let content: string | undefined;

    const params = { ...(ev.values || {}) } as Record<string, any>;

    // console.warn('DIALOGUE TRIGGER ------', params);

    // match button value
    if (params.button && params.button['label']) {
      content = params.button['label'];
    }

    if (!content) return;

    await this.saveMessages(ev.sessionId, [
      {
        type: 'message',
        role: 'user',
        content,
        ts: new Date(),
      },
    ]);
  }

  @OnEvent('dialogue.chat.message', { async: true })
  async handleMessage(ev: DialogueMessageDto) {
    if (!ev.sessionId) return;

    if (ev.actor === 'user') {
      await this.saveMessages(ev.sessionId, [
        {
          type: 'message',
          role: 'user',
          content: ev.text,
          ts: ev.ts || new Date(),
        },
      ]);
      return;
    }

    await this.saveMessages(ev.sessionId, [
      {
        type: 'message',
        role: 'assistant',
        content: ev.text,
        name: ev.avatar || '',
        ts: ev.ts || new Date(),
      },
    ]);
  }

  @OnEvent('ui.content')
  async saveUiContent(ev: UIContentDto) {
    if (!ev.sessionId) return;

    const content = uiContentToText(ev, {
      format: 'history',
      withOptions: true,
    });
    if (!content) return;

    const app = await this.app.readApp(ev.appId, false);
    if (!app) return;

    await this.memory.addMessages(ev.sessionId, [
      {
        role: 'assistant',
        type: 'message',
        content,
        ts: ev.ts || new Date(),
      },
    ]);
  }

  @OnEvent('task.progress')
  // if a task is removed, abort the ongoing records
  async trackProgress(ev: DialogueTaskProgressDto) {
    if (!ev.record?.sessionId) return;

    if (ev.record.status !== 'ongoing') return;

    await this.memory.addMessages(ev.record.sessionId, [
      {
        role: 'assistant',
        type: 'task',
        content: `task ${ev.task.name} ${ev.record.status}`,
        ts: new Date(),
        metadata: {
          taskId: ev.task.taskId,
          status: ev.record.status,
        },
      },
    ]);

    ev.task.name;
  }
}
