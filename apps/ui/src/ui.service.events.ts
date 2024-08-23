import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { UIContentDto } from './ui.content.dto';
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
}
