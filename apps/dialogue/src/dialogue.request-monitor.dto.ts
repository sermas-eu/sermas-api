import { ApiProperty } from '@nestjs/swagger';
import { SermasSessionDto } from 'libs/sermas/sermas.dto';

const DialogueSessionRequestStatusList = [
  'started',
  'processing',
  'ended',
  'cancelled',
] as const;

export type DialogueSessionRequestStatus =
  (typeof DialogueSessionRequestStatusList)[number];

export class DialogueSessionRequestEvent extends SermasSessionDto {
  status: DialogueSessionRequestStatus;
  threshold?: number;
}

export class DialogueSessionRequestDto extends SermasSessionDto {
  @ApiProperty({
    enum: DialogueSessionRequestStatusList,
    enumName: 'DialogueSessionRequestStatus',
  })
  status: DialogueSessionRequestStatus;
}

export class DialogueSessionRequestTracker extends DialogueSessionRequestEvent {
  perf: (label2?: string, print?: boolean) => number;
}
