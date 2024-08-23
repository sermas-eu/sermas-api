import { Injectable, Logger, Inject } from '@nestjs/common';
//import { AsyncApiPub, AsyncApiSub, AsyncApi } from 'nestjs-asyncapi';
import { MqttService } from '../../../libs/mqtt-handler/mqtt.service';
//import { SessionUpdateEventDto } from './data-collection.mqtt.dto';

// const EventPatterns = {
//   updateSession: 'data-collection/save',
//   deleteSession: 'data-collection/delete',
// };

// @AsyncApi()
@Injectable()
export class DataCollectionAsyncApiService {
  private readonly logger = new Logger(DataCollectionAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly mqttService: MqttService) {}
  // @AsyncApiOperationName({
  //   channel: EventPatterns.updateSession,
  //   message: {
  //     payload: SessionUpdateEventDto,
  //   },
  //   description: 'Publish an update for a session',
  // })
  // async eventUpdateSessionPub(sessionEvent: SessionUpdateEventDto) {
  //   this.mqttService.publish(EventPatterns.updateSession, sessionEvent);
  // }
  // @AsyncApiSub({
  //   channel: EventPatterns.updateSession,
  //   message: {
  //     payload: SessionUpdateEventDto,
  //   },
  //   description: 'Receive an event when the session is updated',
  // })
  // async eventUpdateSessionSub() {
  //   //
  // }
}
