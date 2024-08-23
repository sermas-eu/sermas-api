import { DeepFaceAnalyzeItemDto, DeepFaceDetectionEvent } from './deepface.dto';

export interface FaceMatch {
  detection: DeepFaceDetectionEvent;
  distance: number;
}

export interface FaceMatchEvent extends DeepFaceAnalyzeItemDto {
  distance: number;
  verified: boolean;
}
