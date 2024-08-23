import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppSettingsDto } from 'apps/platform/src/app/platform.app.dto';
import { DefaultLanguage } from 'libs/language/lang-codes';
import {
  SermasBaseDto,
  SermasRecordChangedDto,
  SermasSessionDto,
} from 'libs/sermas/sermas.dto';
import { AgentStatus, AgentStatusList } from '../session.dto';

export class AgentHeartBeatEventDto extends SermasSessionDto {
  @ApiPropertyOptional()
  agentId?: string;
  @ApiProperty()
  moduleId: string;
  @ApiProperty({ enum: AgentStatusList, enumName: 'AgentStatus' })
  status: AgentStatus;
  @ApiPropertyOptional()
  settings?: AppSettingsDto;
}

export class AgentDto extends SermasBaseDto {
  @ApiProperty()
  agentId: string;
  @ApiProperty({ enum: AgentStatusList, enumName: 'AgentStatus' })
  status: AgentStatus;
  @ApiProperty()
  modules: AgentHeartBeatEventDto[];
}

export class AgentChangedDto extends SermasRecordChangedDto<AgentDto> {
  @ApiProperty()
  moduleId?: string;

  @ApiProperty()
  sessionId?: string;

  @ApiProperty()
  record: AgentDto;

  @ApiPropertyOptional()
  settings?: AppSettingsDto;
}

export class AgentEvaluatePromptOptionsDto {
  [key: string]: any;
  @ApiPropertyOptional({
    description: 'Include chat history',
    default: false,
  })
  history?: boolean;
  @ApiPropertyOptional({
    description: 'Include contents from documents',
    default: false,
  })
  documents?: boolean;
  @ApiPropertyOptional({
    description: 'Include application prompt',
    default: false,
  })
  app?: boolean;
  @ApiPropertyOptional({
    description: 'Use specified avatar characterization prompt',
  })
  avatar?: string;
  @ApiPropertyOptional({
    description: 'Provide response as JSON',
    default: false,
  })
  json?: boolean;
  @ApiPropertyOptional({
    description: 'Response language',
    default: DefaultLanguage,
  })
  language?: string;
}
