import { Injectable, Logger } from '@nestjs/common';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { DialogueIntentService } from './dialogue.intent.service';

@Injectable()
export class DialogueIntentEventsService {
  private readonly logger = new Logger(DialogueIntentEventsService.name);

  constructor(private readonly intent: DialogueIntentService) {}

  @Subscribe({
    topic: SermasTopics.dialogue.messages,
  })
  async onChatMessage(@Payload() payload: DialogueMessageDto) {
    this.intent.matchOnEvent(payload);
  }
}
