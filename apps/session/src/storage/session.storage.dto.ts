import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SermasBaseDto, SermasRecordChangedDto } from 'libs/sermas/sermas.dto';

export class SessionStorageRecordDto extends SermasBaseDto {
  @ApiPropertyOptional()
  storageId: string;
  @ApiPropertyOptional()
  userId: string;
  @ApiPropertyOptional()
  sessionId?: string;
  @ApiProperty()
  data: Record<string, any>;
}

export class SessionStorageSearchDto {
  @ApiProperty()
  appId: string;
  @ApiPropertyOptional()
  userId?: string[];
  @ApiPropertyOptional()
  sessionId?: string[];
  @ApiPropertyOptional()
  storageId?: string[];
}

export class SessionStorageEventDto extends SermasRecordChangedDto<SessionStorageRecordDto> {
  @ApiProperty()
  record: SessionStorageRecordDto;
}
