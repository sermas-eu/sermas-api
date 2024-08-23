import { ApiProperty } from '@nestjs/swagger';
import {
  SermasRecordChangedDto,
  SermasSessionDto,
} from 'libs/sermas/sermas.dto';
import { DialogueTaskRecordDto } from './record/dialogue.tasks.record.dto';
import {
  DialogueTaskDto,
  TaskEventType,
  TaskEventTypeList,
  TaskFieldDto,
} from './store/dialogue.tasks.store.dto';

export class DialogueTaskProgressDto {
  @ApiProperty({
    description: 'Event type',
    enum: TaskEventTypeList,
    enumName: 'TaskEventType',
  })
  type: TaskEventType;
  @ApiProperty({
    description: 'Task',
    type: DialogueTaskDto,
  })
  task: DialogueTaskDto;
  @ApiProperty({
    description: 'Task field',
    type: DialogueTaskRecordDto,
  })
  record: DialogueTaskRecordDto;
}

export class DialogueTaskChangedDto extends SermasRecordChangedDto<DialogueTaskDto> {
  @ApiProperty({
    type: DialogueTaskDto,
  })
  record: DialogueTaskDto;
}

export class DialogueTaskRecordChangedDto extends SermasRecordChangedDto<DialogueTaskRecordDto> {
  @ApiProperty({
    type: DialogueTaskRecordDto,
  })
  record: DialogueTaskRecordDto;
}

export class DialogueTaskRecordHandlerDto extends SermasSessionDto {
  @ApiProperty({
    description: 'Task Id',
  })
  taskId: string;
  @ApiProperty({
    description: 'Record Id',
  })
  recordId: string;
  @ApiProperty({
    description: 'Field reference',
  })
  field: TaskFieldDto;
}
