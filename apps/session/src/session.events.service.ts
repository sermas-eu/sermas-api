import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  UserDetectionEventDto,
  UserInteractionIntentionDto,
} from 'apps/detection/src/detection.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { UIInteractionEventDto } from 'apps/ui/src/ui.dto';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AgentChangedDto } from './agent/session.agent.dto';
import { SessionService } from './session.service';

@Injectable()
export class SessionEventsService {
  constructor(private session: SessionService) {}

  @Subscribe({
    topic: SermasTopics.detection.interactionIntention,
  })
  onInteractionIntention(@Payload() payload: UserInteractionIntentionDto) {
    this.session.onInteractionIntention(payload);
  }

  @Subscribe({
    topic: SermasTopics.detection.userDetection,
  })
  onUserDetection(@Payload() payload: UserDetectionEventDto) {
    this.session.onUserDetection(payload);
  }

  @Subscribe({
    topic: SermasTopics.ui.interaction,
  })
  onUIInteraction(@Payload() payload: UIInteractionEventDto) {
    this.session.onUIInteraction(payload);
  }

  @Subscribe({
    topic: SermasTopics.session.agentChanged,
  })
  onAgentChanged(@Payload() payload: AgentChangedDto) {
    this.session.onAgentChanged(payload);
  }

  @OnEvent('dialogue.chat.message', { async: true })
  async onDialogueMessage(ev: DialogueMessageDto): Promise<void> {
    this.session.onDialogueMessage(ev);
  }
}
