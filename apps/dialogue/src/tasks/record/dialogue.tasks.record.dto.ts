import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TaskEventType,
  TaskEventTypeList,
} from '../store/dialogue.tasks.store.dto';

export class TaskRecordValues {
  [key: string]: any;
}

export class DialogueTaskRecordDto {
  @ApiProperty({
    description: 'Record ID',
  })
  recordId: string;

  @ApiProperty({
    description: 'Task ID',
  })
  taskId: string;

  @ApiProperty({
    description: 'Application ID reference',
  })
  appId: string;

  @ApiProperty({
    description: 'Session ID reference',
  })
  sessionId: string;

  @ApiPropertyOptional({
    description: 'Status of the task',
    enum: TaskEventTypeList,
    enumName: 'TaskEventType',
  })
  status?: TaskEventType;

  @ApiProperty({
    description: 'Stored values',
    type: Object,
    default: {},
  })
  values: TaskRecordValues;

  @ApiPropertyOptional({
    description: 'Updated date',
  })
  updated: Date;

  @ApiPropertyOptional({
    description: 'Creation date',
  })
  created: Date;
}
