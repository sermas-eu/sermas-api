import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type SermasTopicDto = Record<string, Record<string, string>>;

export class SermasBaseDto {
  @ApiProperty()
  appId: string;

  @ApiPropertyOptional({
    description:
      'Reference to the authenticated client the request originated from',
  })
  clientId?: string;

  @ApiPropertyOptional({
    description: 'Request identifier for monitoring purposes',
  })
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Reference to the user interacting with the system',
  })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Reference date',
    type: Date,
  })
  ts?: Date;
}

export class SermasSessionDto extends SermasBaseDto {
  @ApiPropertyOptional({
    description: 'Track the interaction session, if available',
  })
  sessionId?: string;
}

export type SermasRecordChangedOperation = 'created' | 'updated' | 'deleted';

export abstract class SermasRecordChangedDto<T> extends SermasBaseDto {
  abstract record: T;

  @ApiProperty()
  operation: SermasRecordChangedOperation;

  @ApiPropertyOptional()
  sessionId?: string;
}

export abstract class SermasInferenceValue<T> {
  abstract value: T;
  @ApiProperty()
  probability: number;
}

export class EmotionInferenceValue extends SermasInferenceValue<Emotion> {
  @ApiProperty({ type: String })
  value: Emotion;
}

export class StringInferenceValue extends SermasInferenceValue<string> {
  @ApiProperty()
  value: string;
}

export class NumberInferenceValue extends SermasInferenceValue<number> {
  @ApiProperty()
  value: number;
}

export const EmotionTypes = [
  'neutral',
  'angry',
  'disgust',
  'fear',
  'happy',
  'sad',
  'surprise',
] as const;

export type Emotion = (typeof EmotionTypes)[number];
