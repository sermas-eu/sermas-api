import { Injectable, Logger } from '@nestjs/common';
import { DialogueIntentService } from './dialogue.intent.service.js';

@Injectable()
export class DialogueIntentEventsService {
  private readonly logger = new Logger(DialogueIntentEventsService.name);

  constructor(private readonly intent: DialogueIntentService) {}

  // @Subscribe({
  //   topic: SermasTopics.dialogue.messages,
  // })
  // async onChatMessage(@Payload() payload: DialogueMessageDto) {
  //   this.intent.matchOnEvent(payload);
  // }
}
