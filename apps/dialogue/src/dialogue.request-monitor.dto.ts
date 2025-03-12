import { SermasSessionDto } from 'libs/sermas/sermas.dto';

export type DialogueSessionRequestStatus =
  | 'started'
  | 'processing'
  | 'ended'
  | 'cancelled';

export class DialogueSessionRequestEvent extends SermasSessionDto {
  status: DialogueSessionRequestStatus;
  threshold?: number;
}

export class DialogueSessionRequestTracker extends DialogueSessionRequestEvent {
  perf: (label2?: string, print?: boolean) => number;
}
