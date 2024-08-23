import { Module } from '@nestjs/common';
import { SessionAgentAsyncApiService } from './session.agent.async.service';
import { SessionAgentController } from './session.agent.controller';
import { SessionAgentEventsService } from './session.agent.events.service';
import { SessionAgentService } from './session.agent.service';

@Module({
  imports: [],
  providers: [
    SessionAgentService,
    SessionAgentAsyncApiService,
    SessionAgentEventsService,
  ],
  controllers: [SessionAgentController],
  exports: [SessionAgentService],
})
export class SessionAgentModule {}
