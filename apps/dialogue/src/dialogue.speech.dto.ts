import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ToolsParameterSchema } from '#apps/platform/src/app/platform.app.dto';
import { DialogueMessageDto } from '#libs/language/dialogue.message.dto';
import { SermasSessionDto } from '#libs/sermas/sermas.dto';

export class DialogueToolRequestDto extends SermasSessionDto {
  @ApiProperty()
  name: string;
  @ApiProperty()
  params: ToolsParameterSchema;
}

export type OutgoingQueueMessage = {
  message: DialogueMessageDto;
  data: Buffer;
};

export type OutgoingChunkQueue = {
  streaming: boolean;
  sent: number;
  total: number;
  chunks: Record<
    string,
    {
      loader: Promise<OutgoingQueueMessage>;
      dialogueMessage: DialogueMessageDto;
    }
  >;
};

export class DialogueAvatarSpeechControlDto extends SermasSessionDto {
  @ApiPropertyOptional()
  chunkId?: string;
}

export const DialogueProgressEventList = [
  'stt',
  'analyze',
  'llm',
  'translate',
  'tts',
] as const;

export type DialogueProgressEvent = (typeof DialogueProgressEventList)[number];

export class DialogueProgressEventDto extends SermasSessionDto {
  @ApiProperty()
  event: DialogueProgressEvent;
  @ApiPropertyOptional({ default: 'started' })
  status?: 'started' | 'ended' | 'error';
  @ApiPropertyOptional({
    description:
      'Why the step failed. For `stt`: `no-speech` (nothing transcribed, or the clip too short or quiet) or `other-speaker` (the voice is not the session speaker): the turn is dropped; `noisy` (several turns dropped in a row): the agent suggests typing and the client should offer its keyboard. For `llm`: `skipped` (the message looked like chatter or a fragment and gets no answer).',
  })
  error?: string;
}
