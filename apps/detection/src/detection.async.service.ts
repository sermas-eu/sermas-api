import { Inject, Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { mapMqttTopic } from 'libs/util';
import { AsyncApi } from 'nestjs-asyncapi';
import {
  AudioClassificationEventDto,
  NoiseEventDto,
  ObjectDetectionEventDto,
  QRCodeEventDto,
  UserCharacterizationEventDto,
  UserDetectionEventDto,
  UserInteractionIntentionDto,
} from './detection.dto';

@AsyncApi()
@Injectable()
export class DetectionAsyncApiService {
  private readonly logger = new Logger(DetectionAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.detection.userDetection,
    message: {
      payload: UserDetectionEventDto,
    },
    description: 'Publish an user detection event',
  })
  async userDetected(payload: UserDetectionEventDto) {
    this.broker.publish(SermasTopics.detection.userDetection, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.detection.interactionIntention,
    message: {
      payload: UserInteractionIntentionDto,
    },
    description: 'Publish an user interaction intention event',
  })
  async interactionIntention(payload: UserInteractionIntentionDto) {
    this.broker.publish(SermasTopics.detection.interactionIntention, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.detection.userCharacterization,
    message: {
      payload: UserCharacterizationEventDto,
    },
    description: 'Publish an user emotion event',
  })
  async userCharacterization(payload: UserCharacterizationEventDto) {
    this.broker.publish(SermasTopics.detection.userCharacterization, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.detection.audioClassification,
    message: {
      payload: AudioClassificationEventDto,
    },
    description: 'Publish an audio classification event',
  })
  async audioClassification(payload: AudioClassificationEventDto) {
    this.broker.publish(SermasTopics.detection.audioClassification, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.detection.objectDetection,
    message: {
      payload: ObjectDetectionEventDto,
    },
    description: 'Publish a object detection event',
  })
  async objectDetected(payload: ObjectDetectionEventDto) {
    this.broker.publish(SermasTopics.detection.objectDetection, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.detection.qrCode,
    message: {
      payload: QRCodeEventDto,
    },
    description: 'Publish a QR Code detection event',
  })
  async qrCodeDetected(payload: QRCodeEventDto) {
    this.broker.publish(SermasTopics.detection.qrCode, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.detection.noise,
    message: {
      payload: NoiseEventDto,
    },
    description: 'Publish a noise detection event',
  })
  async noise(payload: NoiseEventDto) {
    this.broker.publish(
      mapMqttTopic(SermasTopics.detection.noise, payload),
      payload,
    );
  }
}
