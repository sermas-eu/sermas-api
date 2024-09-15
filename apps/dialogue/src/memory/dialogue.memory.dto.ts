import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiGenericPropertyOptional } from 'libs/decorator/openapi.decorator';
import {
  LLMMessage,
  LLMRole,
  LLMRoleList,
} from 'libs/llm/providers/provider.dto';

const MemoryMessageTypeList = ['message', 'task', 'tool'] as const;
export type MemoryMessageType = (typeof MemoryMessageTypeList)[number];

export class MessageMetadataDto {
  [key: string]: any;
}

export class DialogueMemoryMessageDto extends LLMMessage {
  @ApiProperty()
  content: string;

  @ApiProperty({
    description: 'role of the message provider',
    enum: LLMRoleList,
    enumName: 'LLMRole',
  })
  role: LLMRole;

  @ApiPropertyOptional({
    description: 'type of message, default to "message"',
    enum: MemoryMessageTypeList,
    enumName: 'MemoryMessageType',
  })
  type?: MemoryMessageType;

  @ApiPropertyOptional()
  name?: string;

  @ApiProperty()
  ts: Date;

  @ApiGenericPropertyOptional({
    type: [MessageMetadataDto],
  })
  metadata?: MessageMetadataDto;
}

export class DialogueMemoryDto {
  @ApiProperty()
  sessionId: string;
  @ApiProperty({
    type: [DialogueMemoryMessageDto],
  })
  messages: DialogueMemoryMessageDto[];
  @ApiProperty()
  created?: Date;
}
