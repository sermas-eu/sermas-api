import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppSettingsDto } from 'apps/platform/src/app/platform.app.dto';
import { SermasBaseDto, SermasRecordChangedDto } from 'libs/sermas/sermas.dto';
import { SearchFilter } from 'libs/sermas/sermas.query.dto';

export const AgentStatusCodes: Record<AgentStatus, number> = {
  // ko
  unavailable: -3000,
  error: -2000,
  not_ready: -1000,
  // ok
  ready: 1000,
  loading: 2000,
  interacting: 3000,
  waiting: 4000,
  processing: 5000,
};

export const AgentStatusList = [
  'unavailable',
  'error',
  'not_ready',
  'ready',
  'loading',
  'interacting',
  'waiting',
  'processing',
] as const;

export type AgentStatus = (typeof AgentStatusList)[number];

export const SessionStatusList = ['started', 'stopped'];
export type SessionStatus = (typeof SessionStatusList)[number];

export const UserReferenceSourceList = [
  'account',
  'camera',
  'voice',
  'qrcode',
  'button',
  'word_match',
  'wake_word',
  'system',
] as const;
export type UserReferenceSource = (typeof UserReferenceSourceList)[number];

export class UserReferenceDto {
  @ApiProperty()
  userId: string;
  @ApiProperty({
    enum: UserReferenceSourceList,
    enumName: 'UserReferenceSource',
  })
  source: UserReferenceSource;
}

export class SessionProperties {
  [key: string]: any;
  @ApiPropertyOptional({
    description: 'Reference to the current tool repository',
  })
  repositoryId?: string;
}

export class SessionDto extends SermasBaseDto {
  @ApiPropertyOptional()
  sessionId?: string;
  @ApiPropertyOptional({
    description: 'Agent instance associated to the session',
  })
  agentId?: string;
  @ApiPropertyOptional({
    description:
      'Collect inferred identifiers of user interacting with the agent during a session.',
  })
  user: UserReferenceDto[];
  @ApiProperty()
  modifiedAt: Date;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  closedAt: Date | null;

  @ApiPropertyOptional({
    type: AppSettingsDto,
  })
  settings?: Partial<AppSettingsDto>;

  @ApiPropertyOptional({
    type: SessionProperties,
  })
  properties?: SessionProperties;
}

export class SessionChangedDto extends SermasRecordChangedDto<SessionDto> {
  @ApiProperty()
  record: SessionDto;
}

export class SessionSearchFilter extends SearchFilter {
  @ApiPropertyOptional()
  query: any;
}
