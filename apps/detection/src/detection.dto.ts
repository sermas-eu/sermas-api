import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PositionDto } from 'apps/robotics/src/robotics.dto';
import { UserReferenceSource } from 'apps/session/src/session.dto';
import {
  Emotion,
  EmotionInferenceValue,
  SermasBaseDto,
  SermasInferenceValue,
  StringInferenceValue,
} from 'libs/sermas/sermas.dto';

export class BoundingBox {
  @ApiProperty()
  x: number;
  @ApiProperty()
  y: number;
  @ApiProperty()
  w: number;
  @ApiProperty()
  h: number;
}

export enum InteractionType {
  start = 'start',
  stop = 'stop',
}

export class UserInteractionIntentionDto extends SermasBaseDto {
  @ApiProperty({
    description: 'Module generating the event',
  })
  moduleId: string;
  @ApiPropertyOptional()
  userId?: string;
  @ApiProperty({ type: String })
  source: UserReferenceSource;
  @ApiProperty()
  probability: number;
  @ApiProperty({
    enum: InteractionType,
  })
  interactionType: InteractionType;
  @ApiProperty()
  sessionId: string;
}

export class AudioClassificationValue extends SermasInferenceValue<string> {
  @ApiProperty({ type: String })
  value: string;
}

export class UserEmotionValue extends SermasInferenceValue<Emotion> {
  @ApiProperty({ type: String })
  value: Emotion;
}

export class UserAgeValue extends SermasInferenceValue<number> {
  @ApiProperty()
  value: number;
}

export class ObjectDetectionDto extends SermasInferenceValue<string> {
  @ApiProperty()
  value: string;
  @ApiProperty()
  bbox?: BoundingBox;
}

export class QRCodeEventDto extends SermasBaseDto {
  @ApiProperty()
  version: string;
  @ApiProperty()
  payload: string;
  @ApiPropertyOptional()
  sessionId?: string;
}

export class NoiseEventDto extends SermasBaseDto {
  @ApiProperty({ type: String })
  noiseType: 'music' | 'people' | 'road';
  @ApiProperty({ type: String })
  level: 'low' | 'mid' | 'high';
  @ApiProperty()
  speakerId: StringInferenceValue[];
}

export class UserDetectionDto {
  @ApiProperty()
  skeleton?: number[][];
  @ApiProperty()
  face?: BoundingBox;
  @ApiProperty()
  faceMask?: number[][];
  @ApiProperty()
  fullBody?: BoundingBox;
  @ApiProperty({
    description: 'A list of matching inferred user identifiers',
    type: [StringInferenceValue],
  })
  user?: StringInferenceValue[];
  @ApiProperty()
  position?: PositionDto;
}

export class UserDetectionEventDto extends SermasBaseDto {
  @ApiProperty()
  cameraId: string;
  @ApiProperty()
  source: string;
  @ApiProperty({
    type: [UserDetectionDto],
  })
  detections: UserDetectionDto[];
}

export class UserCharacterizationDto {
  @ApiProperty({
    type: UserEmotionValue,
  })
  emotion: UserEmotionValue;
  @ApiPropertyOptional({
    type: UserAgeValue,
  })
  age?: UserAgeValue;
  @ApiPropertyOptional({
    description: 'A list of matching inferred user identifiers',
    type: [StringInferenceValue],
  })
  user?: StringInferenceValue[];
}

export class UserIdentificationDto {
  @ApiPropertyOptional({
    description: 'An embeddings of the speaker audio',
    type: StringInferenceValue,
  })
  speakerId?: StringInferenceValue;
}

export enum UserCharacterizationEventSource {
  deepface = 'deepface',
  sentiment_analysis = 'sentiment_analysis',
  emotion_tracker = 'emotion_tracker',
  speechbrain = 'speechbrain',
}

export class UserCharacterizationEventDto extends SermasBaseDto {
  @ApiProperty()
  source: string;
  @ApiProperty({ type: [UserCharacterizationDto] })
  detections: UserCharacterizationDto[];
  @ApiPropertyOptional()
  sessionId?: string;
}

export class UserIdentificationEventDto extends SermasBaseDto {
  @ApiProperty()
  source: string;
  @ApiProperty({ type: [UserIdentificationDto] })
  detections: UserIdentificationDto[];
  @ApiPropertyOptional()
  sessionId?: string;
}

export class AudioClassificationEventDto extends SermasBaseDto {
  @ApiProperty()
  source: string;
  @ApiProperty({ type: [AudioClassificationValue] })
  detections: AudioClassificationValue[];
  @ApiPropertyOptional()
  sessionId?: string;
  @ApiPropertyOptional({
    type: Date,
  })
  ts?: Date;
}

export const ObjectDetectionTypeList = ['CARRIED_OBJECT'] as const;
export type ObjectDetectionType = (typeof ObjectDetectionTypeList)[number];

export class ObjectDetectionRequest extends SermasBaseDto {
  @ApiProperty({ format: 'byte' })
  image: string;
  @ApiProperty({
    enum: ObjectDetectionTypeList,
    default: '',
    enumName: 'ObjectDetectionType',
  })
  detectionType: ObjectDetectionType;
  @ApiProperty()
  filter: [string];
}
export class ObjectDetectionResponse extends SermasBaseDto {
  @ApiProperty({ type: [ObjectDetectionDto] })
  detections: ObjectDetectionDto[];
}

export class ObjectDetectionEventDto extends SermasBaseDto {
  @ApiProperty({ type: [ObjectDetectionDto] })
  detections: ObjectDetectionDto[];
}

export class SentimentAnalysisRequest extends SermasBaseDto {
  @ApiProperty()
  text: string;
}

export class SentimentAnalysisResponse extends SermasBaseDto {
  @ApiProperty()
  emotion: EmotionInferenceValue;
}
