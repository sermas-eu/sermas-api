import { Inject, Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { XRMarkerDto, XRMarkerChangedDto } from './xr.marker.dto';

@AsyncApi()
@Injectable()
export class XRMarkerAsyncApiService {
  private readonly logger = new Logger(XRMarkerAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.xr.markerDetected,
    message: {
      payload: XRMarkerDto,
    },
    description: 'Provide detected QR code markers',
  })
  async detected(payload: XRMarkerDto) {
    this.broker.publish(SermasTopics.xr.markerDetected, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.xr.markerChanged,
    message: {
      payload: XRMarkerChangedDto,
    },
    description: 'Provide detected QR code markers',
  })
  async changed(payload: XRMarkerChangedDto) {
    this.broker.publish(SermasTopics.xr.markerChanged, payload);
  }
}
