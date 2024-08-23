import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApiExtraModels } from '@nestjs/swagger';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { AsyncApi } from 'nestjs-asyncapi';
import { UIAssetChangedDto } from './ui.asset.dto';
import { UIContentDto } from './ui.content.dto';
import { UIInteractionEventDto } from './ui.dto';

@AsyncApi()
@Injectable()
@ApiExtraModels(UIInteractionEventDto)
export class UIAsyncApiService {
  private readonly logger = new Logger(UIAsyncApiService.name);
  constructor(@Inject(MqttService) private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.ui.assetStatus,
    message: {
      payload: UIAssetChangedDto,
    },
    description: 'Publish a status update for a UI asset',
  })
  async assetChanged(payload: UIAssetChangedDto) {
    this.broker.publish(SermasTopics.ui.assetStatus, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.ui.content,
    message: {
      payload: UIContentDto,
    },
    description: 'Publish an event with content to show',
  })
  async content(payload: UIContentDto) {
    this.broker.publish(SermasTopics.ui.content, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.ui.interaction,
    message: {
      payload: UIInteractionEventDto,
    },
    description: 'Publish an user interaction event',
  })
  async interaction(payload: UIInteractionEventDto) {
    this.broker.publish(SermasTopics.ui.interaction, payload);
  }
}
