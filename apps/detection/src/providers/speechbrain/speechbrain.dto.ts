import {
  EmotionInferenceValue,
  StringInferenceValue,
  NumberInferenceValue,
} from 'libs/sermas/sermas.dto';

export class SpeechBrainClassification {
  language: StringInferenceValue;
  emotion: EmotionInferenceValue;
  embeddings: StringInferenceValue;
}

export class SpeechBrainSpeakerCount {
  speakerCount: NumberInferenceValue;
}

export class SpeechBrainSeparation {
  language?: StringInferenceValue;
  emotion?: EmotionInferenceValue;
  speakerCount: NumberInferenceValue;
}
