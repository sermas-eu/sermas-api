import { Module } from '@nestjs/common';
import { RoboticsAgentController } from './agent/robotics.agent.controller';
import { RoboticsAgentService } from './agent/robotics.agent.service';
import { RoboticsAsyncApiService } from './robotics.async.service';
import { AuthModule } from 'apps/auth/src/auth.module';
import { NavigationModule } from './navigation/navigation.module';
import { RoboticsAgentEventsService } from './agent/robotics.agent.events.service';

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
