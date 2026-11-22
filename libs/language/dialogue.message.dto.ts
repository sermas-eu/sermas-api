import {
  Allow,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LLMSettingsDto } from '#apps/platform/src/app/platform.app.tools.dto';
import { Emotion, SermasSessionDto } from '#libs/sermas/sermas.dto';

export const DialogueActorList = ['user', 'agent'] as const;
export type DialogueActor = (typeof DialogueActorList)[number];

export class DialogueMessageDto extends SermasSessionDto {
  // no `type`: with one, @nestjs/swagger 12 ignores enumName and inlines the enum
  @ApiPropertyOptional({
    enum: DialogueActorList,
    enumName: 'DialogueActor',
    description: 'Actor providing the text, can be user or agent',
  })
  @IsOptional()
  @IsString()
  actor: DialogueActor;
  @ApiProperty({
    description:
      'Indicate a chunck identifier as timestamp, usually indicating it is part of a stream.',
  })
  @IsOptional()
  @IsString()
  text: string;
  @ApiPropertyOptional({
    description: 'Assistant gender (M or F)',
  })
  @IsOptional()
  @IsString()
  gender?: string;
  @ApiPropertyOptional({
    description: 'Text language',
  })
  @Allow()
  language: string | null;
  @ApiPropertyOptional({
    type: String,
    description: 'User emotion, if available',
  })
  @IsOptional()
  @IsString()
  emotion?: Emotion;
  @ApiPropertyOptional({
    description: 'User session identifier',
  })
  @IsOptional()
  @IsString()
  sessionId: string;
  @ApiPropertyOptional({
    description: 'LLM engine to use',
  })
  @IsOptional()
  @IsObject()
  llm?: LLMSettingsDto;
  @ApiPropertyOptional({
    description: 'The avatar id used for interaction',
  })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({
    description: 'Unique sortable ID used to group and sort messages',
  })
  @IsOptional()
  @IsString()
  messageId?: string;

  @ApiPropertyOptional({
    description:
      'Unique sortable ID used to sort chunks from the same messageId',
  })
  @IsOptional()
  @IsString()
  chunkId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Toggle TTS rendering for this message',
  })
  @IsOptional()
  @IsBoolean()
  ttsEnabled?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Specify if it is a welcome message',
  })
  @IsOptional()
  @IsBoolean()
  isWelcome?: boolean;
}
