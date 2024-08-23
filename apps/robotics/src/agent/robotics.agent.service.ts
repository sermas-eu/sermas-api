import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { readFile } from 'fs/promises';
import { getConfigPath } from 'libs/sermas/sermas.utils';
import { fileExists } from 'libs/util';
import { NavigationService } from '../navigation/navigation.service';
import { RoboticsAsyncApiService } from '../robotics.async.service';
import {
  ActuationEventDto,
  InitialPoseDto,
  MovementEventDto,
  StatusEventDto,
} from '../robotics.dto';

class RobotConfig {
  name: string;
  initialPose: InitialPoseDto;
}

@Injectable()
export class RoboticsAgentService {
  private readonly logger = new Logger(RoboticsAgentService.name);

  private robotConfig: RobotConfig;

  constructor(
    private readonly config: ConfigService,
    private readonly navigation: NavigationService,
    private readonly asyncApi: RoboticsAsyncApiService,
    private readonly emitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.loadRobotConfig();
  }

  async loadRobotConfig() {
    try {
      const robotsFile = `${getConfigPath()}/robots.json`;
      if (!(await fileExists(robotsFile))) return;
      const raw = (await readFile(robotsFile)).toString();
      const config = JSON.parse(raw) as RobotConfig[];
      if (config.length > 0) {
        this.robotConfig = config[0];
      }
    } catch (e: any) {
      this.logger.warn(`Failed to read robots config: ${e.message}`);
      return;
    }
  }

  async move(payload: MovementEventDto) {
    await this.asyncApi.move(payload);
  }

  async initialPose(appId: string, clientId: string) {
    const payload = {
      appId,
      clientId,
      initialPose: this.robotConfig.initialPose,
    };
    this.logger.log(`Set initial pose ${JSON.stringify(payload)}`);
    await this.asyncApi.initialPose(payload);
  }

  async moveToArea(appId: string, name: string): Promise<string> {
    const area = await this.navigation.matchAreaByName(appId, name);
    if (!area) {
      this.logger.warn(`Area not found: ${name}`);
      return `Sorry, the robot can not move to ${name}`;
    }
    this.logger.log(`!!! Move to area ${name} (appId:${appId})`);
    this.asyncApi.move({
      appId,
      movement: {
        targetPosition: area.position,
      },
    } as MovementEventDto);

    return `Command sent`;
  }

  async actuate(payload: ActuationEventDto) {
    this.asyncApi.actuate(payload);
  }

  // event mqtt 'app/:appId/robotics/status'
  async status(payload: StatusEventDto) {
    this.asyncApi.robotStatus(payload);
  }

  async statusDescription(appId: string, robotId?: string) {
    try {
      this.logger.log(`Get robot status appId=${appId} robotId=${robotId}`);

      const status = await this.navigation.getStatus(appId, robotId);
      if (!status) return `Sorry, the robot has no status available`;

      if (
        status.velocity?.linear.x ||
        status.velocity?.linear.y ||
        status.velocity?.linear.z
      ) {
        return `The robot is moving`;
      }

      return `Robot is stopped`;
    } catch {
      return `Cannot find the robot ${robotId} status`;
    }
  }
}
