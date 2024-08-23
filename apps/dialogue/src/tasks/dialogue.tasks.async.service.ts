import { Injectable, Logger } from '@nestjs/common';
import { AsyncApiOperationName } from 'libs/decorator/asyncapi.operation.decorator';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { mapMqttTopic } from 'libs/util';
import { AsyncApi } from 'nestjs-asyncapi';
import {
  DialogueTaskChangedDto,
  DialogueTaskProgressDto,
  DialogueTaskRecordChangedDto,
  DialogueTaskRecordHandlerDto,
} from './dialogue.tasks.dto';

@AsyncApi()
@Injectable()
export class DialogueTasksAsyncApiService {
  private readonly logger = new Logger(DialogueTasksAsyncApiService.name);
  constructor(private readonly broker: MqttService) {}

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.taskChanged,
    message: {
      payload: DialogueTaskChangedDto,
    },
    description: 'Publish a task change event',
  })
  async taskChanged(payload: DialogueTaskChangedDto) {
    this.broker.publish(
      mapMqttTopic(SermasTopics.dialogue.taskChanged, {
        appId: payload.appId,
        taskId: payload.record.taskId,
      }),
      payload,
    );
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.taskProgress,
    message: {
      payload: DialogueTaskProgressDto,
    },
    description: 'Publish a task progress event',
  })
  async taskProgress(payload: DialogueTaskProgressDto) {
    this.broker.publish(
      mapMqttTopic(SermasTopics.dialogue.taskProgress, {
        appId: payload.task.appId,
        taskId: payload.task.taskId,
      }),
      payload,
    );
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.taskRecordChanged,
    message: {
      payload: DialogueTaskRecordChangedDto,
    },
    description: 'Publish a task record update event',
  })
  async recordChanged(payload: DialogueTaskRecordChangedDto) {
    this.broker.publish(SermasTopics.dialogue.taskRecordChanged, payload);
  }

  @AsyncApiOperationName({
    channel: SermasTopics.dialogue.taskFieldHandler,
    message: {
      payload: DialogueTaskRecordHandlerDto,
    },
    description: 'Publish a task field handler event',
  })
  async fieldHandler(payload: DialogueTaskRecordHandlerDto) {
    this.broker.publish(SermasTopics.dialogue.taskFieldHandler, payload);
  }
}
