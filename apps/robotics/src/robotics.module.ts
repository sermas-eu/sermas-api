import { Module } from '@nestjs/common';
import { RoboticsAgentController } from './agent/robotics.agent.controller.js';
import { RoboticsAgentService } from './agent/robotics.agent.service.js';
import { RoboticsAsyncApiService } from './robotics.async.service.js';
import { AuthModule } from '#apps/auth/src/auth.module';
import { NavigationModule } from './navigation/navigation.module.js';
import { RoboticsAgentEventsService } from './agent/robotics.agent.events.service.js';

@Module({
  imports: [AuthModule, NavigationModule],
  controllers: [RoboticsAgentController],
  providers: [
    RoboticsAsyncApiService,
    RoboticsAgentService,
    RoboticsAgentEventsService,
  ],
})
export class RoboticsModule {}
