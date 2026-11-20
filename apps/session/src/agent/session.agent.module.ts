import { Module } from '@nestjs/common';
import { SessionAgentAsyncApiService } from './session.agent.async.service.js';
import { SessionAgentController } from './session.agent.controller.js';
import { SessionAgentEventsService } from './session.agent.events.service.js';
import { SessionAgentService } from './session.agent.service.js';

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
