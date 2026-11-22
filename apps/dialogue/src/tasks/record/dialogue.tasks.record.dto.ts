import { Allow, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TaskEventType,
  TaskEventTypeList,
} from '../store/dialogue.tasks.store.dto.js';

export class TaskRecordValues {
  [key: string]: any;
}

export class DialogueTaskRecordDto {
  @ApiProperty({
    description: 'Record ID',
  })
  @IsOptional()
  @IsString()
  recordId: string;

  @ApiProperty({
    description: 'Task ID',
  })
  @IsOptional()
  @IsString()
  taskId: string;

  @ApiProperty({
    description: 'Application ID reference',
  })
  @IsOptional()
  @IsString()
  appId: string;

  @ApiProperty({
    description: 'Session ID reference',
  })
  @IsOptional()
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({
    description: 'Status of the task',
    enum: TaskEventTypeList,
    enumName: 'TaskEventType',
  })
  @IsOptional()
  @IsString()
  status?: TaskEventType;

  @ApiProperty({
    description: 'Stored values',
    type: Object,
    default: {},
  })
  @Allow()
  values: TaskRecordValues;

  @ApiPropertyOptional({
    description: 'Updated date',
  })
  @Allow()
  updated: Date;

  @ApiPropertyOptional({
    description: 'Creation date',
  })
  @Allow()
  created: Date;
}
