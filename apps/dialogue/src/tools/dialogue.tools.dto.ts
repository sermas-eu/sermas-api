import { ApiProperty } from '@nestjs/swagger';
import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import {
  SermasRecordChangedDto,
  SermasSessionDto,
} from 'libs/sermas/sermas.dto';
import { DialogueToolsRepositoryRecordDto } from './repository/dialogue.tools.repository.dto';

export const TOOL_CATCH_ALL = 'collect-user-message';
export const TOOL_CATCH_ALL_VALUE = 'value';

export class DialogueToolTriggeredEventDto extends SermasSessionDto {
  @ApiProperty()
  name: string;
  @ApiProperty()
  tool: AppToolsDTO;
}

export class DialogueToolsRepositoryChanged extends SermasRecordChangedDto<DialogueToolsRepositoryRecordDto> {
  @ApiProperty({})
  record: DialogueToolsRepositoryRecordDto;
}
