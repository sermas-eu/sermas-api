import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiGenericProperty } from 'libs/decorator/openapi.decorator';
import { SermasSessionDto } from 'libs/sermas/sermas.dto';

export const LogTypeList = [
  'characterization',
  'stt',
  'tts',
  'interaction',
  'session',
  'document',
  'chat',
  'task',
  'performance',
  'kpi',
  'error',
  'llm',
  'log',
] as const;

export type LogType = (typeof LogTypeList)[number];

export class DatasetRecordFilterDto extends SermasSessionDto {
  @ApiProperty()
  sessionId: string;
  @ApiPropertyOptional({
    isArray: true,
    enum: LogTypeList,
    enumName: 'LogType',
  })
  types?: LogType[];
}

export class AdvancedDatasetRecordFilterDto {
  @ApiPropertyOptional()
  appId?: string;
  @ApiPropertyOptional()
  sessionId?: string;
  @ApiPropertyOptional({
    enum: LogTypeList,
    enumName: 'LogType',
  })
  type: LogType;
  @ApiPropertyOptional()
  label?: string;
  @ApiPropertyOptional()
  sinceTs?: Date;
  @ApiPropertyOptional()
  untilTs?: Date;
}

export class MonitoringRecordDto {
  @ApiProperty()
  appId: string;
  @ApiProperty()
  sessionId: string;
  @ApiPropertyOptional({
    enum: LogTypeList,
    enumName: 'LogType',
  })
  type: LogType;
  @ApiProperty()
  label: string;
  @ApiProperty()
  ts: Date;
}

export class DatasetRecordDto extends MonitoringRecordDto {
  @ApiGenericProperty()
  data: any;
}
