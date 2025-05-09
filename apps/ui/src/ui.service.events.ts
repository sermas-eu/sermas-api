import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { DialogueTaskProgressDto } from 'apps/dialogue/src/tasks/dialogue.tasks.dto';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { ClearScreenDto, UIContentDto } from './ui.content.dto';
import { UIService } from './ui.service';

@Injectable()
export class UIEventsService {
  private readonly logger = new Logger(UIEventsService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly ui: UIService,
  ) {}

  @Subscribe({
    topic: SermasTopics.ui.content,
  })
  async onUiContent(@Payload() content: UIContentDto) {
    this.emitter.emit('ui.content', content);
  }

  @OnEvent('session.changed')
  async onSessionChanged(content: SessionChangedDto) {
    this.ui.onSessionChanged(content);
  }

  @OnEvent('task.progress')
  // if a task is removed, abort the ongoing records
  async trackProgress(ev: DialogueTaskProgressDto) {
    if (!ev.record?.sessionId) return;
    if (ev.type !== 'started' && ev.type !== 'aborted') return;

    this.logger.debug(`Task ${ev.task.name} ${ev.type}, clearing screen`);
    await this.ui.sendClearScreen(ev.record);
  }
}
