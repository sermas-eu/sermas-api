import { Inject, Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { MonitoringRecordDto } from './monitoring.dataset.dto';

@AsyncApi()
@Injectable()
export class MonitoringAsyncApiService {
  private readonly logger = new Logger(MonitoringAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.platform.monitoringRecord,
    message: {
      payload: MonitoringRecordDto,
    },
    description: 'Publish an update for a monitoring record update',
  })
  async record(payload: MonitoringRecordDto) {
    this.broker.publish(SermasTopics.platform.monitoringRecord, payload);
  }
}
