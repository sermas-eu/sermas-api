import { Allow, IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SermasBaseDto, SermasRecordChangedDto } from '#libs/sermas/sermas.dto';

export class SessionStorageRecordDto extends SermasBaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storageId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;
  @ApiProperty()
  @Allow()
  data: Record<string, any>;
}

export class SessionStorageSearchDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  appId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  userId?: string[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  sessionId?: string[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  storageId?: string[];
}

export class SessionStorageEventDto extends SermasRecordChangedDto<SessionStorageRecordDto> {
  @ApiProperty()
  record: SessionStorageRecordDto;
}
