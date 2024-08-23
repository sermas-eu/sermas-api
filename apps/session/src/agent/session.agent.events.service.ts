import { Injectable } from '@nestjs/common';
import { PlatformAppChangedDto } from 'apps/platform/src/app/platform.app.dto';
import { SessionAgentService } from 'apps/session/src/agent/session.agent.service';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AgentHeartBeatEventDto } from './session.agent.dto';

@Injectable()
export class SessionAgentEventsService {
  constructor(private readonly agent: SessionAgentService) {}

  @Subscribe({
    topic: SermasTopics.session.agentHeartBeat,
  })
  onAgentHeartBeat(@Payload() payload: AgentHeartBeatEventDto) {
    this.agent.onAgentHeartBeat(payload);
  }

  @Subscribe({
    topic: SermasTopics.platform.appChanged,
  })
  async onAppChanged(@Payload() payload: PlatformAppChangedDto) {
    this.agent.onAppChanged(payload);
  }
}
