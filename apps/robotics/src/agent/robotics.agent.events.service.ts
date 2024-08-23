import { Injectable, Logger } from '@nestjs/common';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { NavigationService } from '../navigation/navigation.service';
import { StatusEventDto } from '../robotics.dto';

@Injectable()
export class RoboticsAgentEventsService {
  private readonly logger = new Logger(RoboticsAgentEventsService.name);

  constructor(private readonly navigation: NavigationService) {}

  @Subscribe({
    topic: SermasTopics.robotics.status,
    args: {
      appId: '+',
    },
  })
  onStatusUpdate(@Payload() payload: StatusEventDto) {
    this.navigation.onStatusUpdate(payload);
  }
}
