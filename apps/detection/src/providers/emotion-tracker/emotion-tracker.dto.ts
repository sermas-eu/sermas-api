import { Emotion } from 'libs/sermas/sermas.dto';

export interface EmotionProcessingData {
  values: number[];
  normalized: number[];
  avg?: number;
  softmax?: number[];
}

export interface EmotionRecord {
  appId: string;
  sessionId?: string;
  ts: Date;
  emotion: Emotion;
  value: number;
}
