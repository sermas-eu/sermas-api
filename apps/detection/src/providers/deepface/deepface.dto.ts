import { VideoFrameEvent } from '../../detection.streamer.dto';

export type DeepFaceModel =
  | 'VGG-Face'
  | 'Facenet'
  | 'Facenet512'
  | 'OpenFace'
  | 'DeepFace'
  | 'DeepID'
  | 'ArcFace'
  | 'Dlib'
  | 'SFace';

export type DeepFaceMetric = 'cosine' | 'euclidean' | 'euclidean_l2';

export type DeepFaceBackend =
  | 'opencv'
  | 'ssd'
  | 'dlib'
  | 'mtcnn'
  | 'retinaface'
  | 'mediapipe';

export interface DeepFaceAnalyzeDto {
  img_path: string;
  enforce_detection: boolean;
}

export interface DeepFaceVerifyDto {
  img1_path: string;
  img2_path: string;
  model_name?: DeepFaceModel;
  detector_backend?: DeepFaceBackend;
  distance_metric?: DeepFaceMetric;
  enforce_detection?: boolean;
}

export interface DeepFaceAnalyzeResponseDto {
  results: DeepFaceAnalyzeItemDto[];
}

export interface DeepFaceAnalyzeItemDto {
  age?: number;
  dominant_emotion?: DeepFaceEmotion;
  dominant_gender?: string;
  dominant_race?: string;
  emotion?: Emotions;
  gender?: Gender;
  race?: Race;
  region?: Region;
}

export type DeepFaceEmotion =
  | 'happy'
  | 'fear'
  | 'sad'
  | 'surprise'
  | 'disgust'
  | 'angry'
  | 'neutral';

export interface DeepFaceDetectionEvent extends VideoFrameEvent {
  detections: DeepFaceAnalyzeItemDto[];
}

export interface Emotions {
  angry: number;
  disgust: number;
  fear: number;
  happy: number;
  neutral: number;
  sad: number;
  surprise: number;
}

export interface Gender {
  Man: number;
  Woman: number;
}

export interface Race {
  asian: number;
  black: number;
  indian: number;
  'latino hispanic': number;
  'middle eastern': number;
  white: number;
}

export interface Region {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface DeepFaceVerifyResultDto {
  verified: string;
  distance: number;
  max_threshold_to_verify: number;
  model: DeepFaceModel;
  similarity_metric: DeepFaceMetric;
  facial_areas: Record<string, Region>;
  time: number;
}
