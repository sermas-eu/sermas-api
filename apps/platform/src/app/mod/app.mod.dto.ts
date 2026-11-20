import { ApiProperty } from '@nestjs/swagger';
import { SermasRecordChangedDto } from '#libs/sermas/sermas.dto';
import { AppModuleConfigDto } from '../platform.app.dto.js';

export class PlatformAppModuleConfigEventDto extends SermasRecordChangedDto<AppModuleConfigDto> {
  @ApiProperty()
  record: AppModuleConfigDto;
}
