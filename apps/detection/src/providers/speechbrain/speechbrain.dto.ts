import {
  EmotionInferenceValue,
  StringInferenceValue,
} from 'libs/sermas/sermas.dto';

export class SpeechBrainClassification {
  language?: StringInferenceValue;
  emotion: EmotionInferenceValue;
  speakerId?: StringInferenceValue;
}
