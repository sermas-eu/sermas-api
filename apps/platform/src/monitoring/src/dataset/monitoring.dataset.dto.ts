import { Allow, IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiGenericProperty } from '#libs/decorator/openapi.generic.decorator';
import { SermasSessionDto } from '#libs/sermas/sermas.dto';

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
  @IsOptional()
  @IsString()
  sessionId: string;
  @ApiPropertyOptional({
    isArray: true,
    enum: LogTypeList,
    enumName: 'LogType',
  })
  @IsOptional()
  @IsArray()
  types?: LogType[];
}

export class AdvancedDatasetRecordFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;
  @ApiPropertyOptional({
    enum: LogTypeList,
    enumName: 'LogType',
  })
  @IsOptional()
  @IsString()
  type: LogType;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;
  @ApiPropertyOptional()
  @Allow()
  sinceTs?: Date;
  @ApiPropertyOptional()
  @Allow()
  untilTs?: Date;
}

export class MonitoringRecordDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  appId: string;
  @ApiProperty()
  @IsOptional()
  @IsString()
  sessionId: string;
  @ApiPropertyOptional({
    enum: LogTypeList,
    enumName: 'LogType',
  })
  @IsOptional()
  @IsString()
  type: LogType;
  @ApiProperty()
  @IsOptional()
  @IsString()
  label: string;
  @ApiProperty()
  @Allow()
  ts: Date;
}

export class DatasetRecordDto extends MonitoringRecordDto {
  @ApiGenericProperty()
  @Allow()
  data: any;
}
