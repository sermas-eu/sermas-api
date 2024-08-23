import { Inject, Injectable, Logger } from '@nestjs/common';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import {
  ActuationEventDto,
  InitialPoseEventDto,
  MovementEventDto,
  OperationalStateEventDto,
  StatusEventDto,
} from './robotics.dto';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';

@AsyncApi()
@Injectable()
export class RoboticsAsyncApiService {
  private readonly logger = new Logger(RoboticsAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.robotics.actuation,
    message: {
      payload: ActuationEventDto,
    },
    description: 'Publish a robot actuation event',
  })
  async actuate(payload: ActuationEventDto) {
    this.broker.publish(SermasTopics.robotics.actuation, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.robotics.movement,
    message: {
      payload: MovementEventDto,
    },
    description: 'Publish a robot movement event',
  })
  async move(payload: MovementEventDto) {
    this.broker.publish(SermasTopics.robotics.movement, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.robotics.status,
    message: {
      payload: StatusEventDto,
    },
    description: 'Publish a robot status event',
  })
  async robotStatus(payload: StatusEventDto) {
    this.broker.publish(SermasTopics.robotics.status, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.robotics.initialPose,
    message: {
      payload: InitialPoseEventDto,
    },
    description: 'Publish a robot initial pose event',
  })
  async initialPose(payload: InitialPoseEventDto) {
    this.broker.publish(SermasTopics.robotics.initialPose, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.robotics.opState,
    message: {
      payload: OperationalStateEventDto,
    },
    description: 'Publish a robot operational state event',
  })
  async opState(payload: InitialPoseEventDto) {
    this.broker.publish(SermasTopics.robotics.opState, payload);
  }
}
