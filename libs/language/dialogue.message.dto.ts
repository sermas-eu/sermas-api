import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LLMSettingsDto } from 'apps/platform/src/app/platform.app.dto';
import { Emotion, SermasSessionDto } from 'libs/sermas/sermas.dto';

export const DialogueActorList = ['user', 'agent'] as const;
export type DialogueActor = (typeof DialogueActorList)[number];

export class DialogueMessageDto extends SermasSessionDto {
  @ApiPropertyOptional({
    type: String,
    enum: DialogueActorList,
    enumName: 'DialogueActor',
    description: 'Actor providing the text, can be user or agent',
  })
  actor: DialogueActor;
  @ApiProperty({
    description:
      'Indicate a chunck identifier as timestamp, usually indicating it is part of a stream.',
  })
  text: string;
  @ApiPropertyOptional({
    description: 'Assistant gender (M or F)',
  })
  gender?: string;
  @ApiPropertyOptional({
    description: 'Text language',
  })
  language: string | null;
  @ApiPropertyOptional({
    type: String,
    description: 'User emotion, if available',
  })
  emotion?: Emotion;
  @ApiPropertyOptional({
    description: 'User session identifier',
  })
  sessionId: string;
  @ApiPropertyOptional({
    description: 'LLM engine to use',
  })
  llm?: LLMSettingsDto;
  @ApiPropertyOptional({
    description: 'The avatar id used for interaction',
  })
  avatar?: string;

  @ApiPropertyOptional({
    description: 'Unique sortable ID used to group and sort messages',
  })
  messageId?: string;

  @ApiPropertyOptional({
    description:
      'Unique sortable ID used to sort chunks from the same messageId',
  })
  chunkId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Toggle TTS rendering for this message',
  })
  ttsEnabled?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Specify if it is a welcome message',
  })
  isWelcome?: boolean;
}
