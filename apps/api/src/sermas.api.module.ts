import { Module } from '@nestjs/common';
import { AuthModule } from 'apps/auth/src/auth.module';
import { DetectionModule } from 'apps/detection/src/detection.module';
import { DialogueModule } from 'apps/dialogue/src/dialogue.module';
import { MonitoringModule } from 'apps/platform/src/monitoring/src/monitoring.module';
import { PlatformModule } from 'apps/platform/src/platform.module';
import { RoboticsModule } from 'apps/robotics/src/robotics.module';
import { SessionPromptModule } from 'apps/session/src/prompt/session.prompt.module';
import { SessionModule } from 'apps/session/src/session.module';
import { UiModule } from 'apps/ui/src/ui.module';
import { XrModule } from 'apps/xr/src/xr.module';

@Module({
  imports: [
    PlatformModule,
    AuthModule,
    DetectionModule,
    DialogueModule,
    SessionModule,
    SessionPromptModule,
    UiModule,
    MonitoringModule,
    XrModule,
    RoboticsModule,

    // DataCollectionModule,
    // ChatModule,
  ],
})
export class SermasApiModule {}
