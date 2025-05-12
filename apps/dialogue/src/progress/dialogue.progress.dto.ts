import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DialogueProgressEventList = [
  'stt',
  'analyze',
  'llm',
  'translate',
  'tts',
] as const;

export type DialogueProgressEvent = (typeof DialogueProgressEventList)[number];

export class DialogueProgressEventDto {
  @ApiProperty()
  event: DialogueProgressEvent;
  @ApiPropertyOptional({ default: 'started' })
  status?: 'started' | 'ended';
}
