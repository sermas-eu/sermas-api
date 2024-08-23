import { UserEmotionValue } from '../../detection.dto';

export class ObjectDetection {
  objectClass: string;
  // bbox: [number];
}

export class ObjectDetectionResult {
  detections: [ObjectDetection];
}
