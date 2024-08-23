import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { AgentChangedDto, AgentDto } from './session.agent.dto';

@AsyncApi()
@Injectable()
export class SessionAgentAsyncApiService {
  private readonly logger = new Logger(SessionAgentAsyncApiService.name);
  constructor(
    private readonly emitter: EventEmitter2,
    private readonly broker: MqttService,
  ) {}

  @AsyncApiOperationName({
    channel: SermasTopics.session.agentInteraction,
    message: {
      payload: AgentDto,
    },
    description: 'Publish a status update for agent interaction',
  })
  async agentInteraction(payload: AgentDto) {
    this.broker.publish(SermasTopics.session.agentInteraction, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.session.agentChanged,
    message: {
      payload: AgentChangedDto,
    },
    description: 'Publish updates for agent record changes',
  })
  async agentChanged(payload: AgentChangedDto) {
    this.broker.publish(SermasTopics.session.agentChanged, payload);
  }
}
