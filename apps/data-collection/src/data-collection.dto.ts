import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DataCollectionSlotSpanDto {
  @ApiProperty()
  span_type: string;
  @ApiProperty()
  span: string;
  @ApiProperty()
  span_character_start_position: number;
}

export class AttachmentsDto {
  @ApiProperty()
  source: string;
  @ApiProperty()
  reference: string;
  @ApiProperty()
  documentId: string;
  @ApiProperty({ type: [DataCollectionSlotSpanDto] })
  phrases: DataCollectionSlotSpanDto[];
  @ApiPropertyOptional()
  content?: string;
}

export class DataCollectionUploadedDocumentDto {
  @ApiProperty()
  source: 'upload' | 'url';
  @ApiProperty()
  reference: string;
  @ApiProperty()
  documentId: string;
  @ApiProperty({ type: [DataCollectionSlotSpanDto] })
  phrases: DataCollectionSlotSpanDto[];
}

export type DataCollectionFeedbackCode =
  | 'satisfaction'
  | 'error'
  | 'user_response';

export type DataCollectionFeedbackErrorCode =
  | 'e1'
  | 'e2'
  | 'e3'
  | 'e4'
  | 'e5'
  | 'e6'
  | 'e7'
  | 'e8'
  | 'e9'
  | 'e10';

export type DataCollectionFeedbackUserResponseCode =
  | 'ur1'
  | 'ur2'
  | 'ur3'
  | 'ur4'
  | 'ur5';
export class DataCollectionFeedbackDto {
  @ApiProperty()
  feedback: DataCollectionFeedbackCode;
  @ApiProperty()
  code:
    | DataCollectionFeedbackErrorCode
    | DataCollectionFeedbackUserResponseCode
    | '';
  @ApiProperty()
  source?: string;
  @ApiProperty()
  correction?: string;
  @ApiProperty()
  wrong?: string;
}

export class DataCollectionDataRecordDto {
  @ApiProperty()
  subject: 'agent' | 'user';
  @ApiProperty()
  intent: string;
  @ApiProperty()
  text: string;
  @ApiProperty({ type: [DataCollectionSlotSpanDto] })
  slots: DataCollectionSlotSpanDto[];
  @ApiProperty({ type: [DataCollectionFeedbackDto] })
  feedbacks?: DataCollectionFeedbackDto[];
  @ApiProperty({ type: [AttachmentsDto] })
  attachments: AttachmentsDto[];
  @ApiProperty()
  timestamp: Date;
  @ApiProperty({ default: '' })
  emotion: string;
  @ApiProperty({ default: '' })
  gesture: string;
  @ApiProperty({ default: '' })
  action: string;
}

export class DataCollectionSessionDto {
  @ApiProperty()
  groupId: string;
  @ApiProperty()
  sessionId: string;
  @ApiProperty()
  label: string;
  @ApiProperty()
  authorId: string;
  @ApiProperty()
  created_at: Date;
  @ApiProperty()
  modified_at: Date;
  @ApiProperty({ type: [DataCollectionDataRecordDto] })
  records: DataCollectionDataRecordDto[];
}

export class DataCollectionGroupDto {
  @ApiProperty()
  groupId: string;
}

export class SaveAttachmentResponseDto {
  @ApiProperty()
  fileName: string;
  @ApiProperty()
  ext: string;
  @ApiProperty()
  content?: string;
}

export class GroupStats {
  @ApiProperty()
  groupId: string;
  @ApiProperty()
  sessionsCount: number;
  @ApiProperty()
  dialogueCount: number;
  @ApiProperty()
  avgDialoguesCount: number;
  @ApiProperty()
  attachmentsCount: number;
  @ApiProperty()
  feedbacksCount: number;
  @ApiProperty()
  avgUtterancesLength: number;
}
