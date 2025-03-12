import { ApiProperty } from '@nestjs/swagger';
import { ToolsParameterSchema } from 'apps/platform/src/app/platform.app.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { SermasSessionDto } from 'libs/sermas/sermas.dto';

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
