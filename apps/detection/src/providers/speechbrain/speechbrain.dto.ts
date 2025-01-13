import {
  EmotionInferenceValue,
  StringInferenceValue,
  NumberInferenceValue,
} from 'libs/sermas/sermas.dto';

export class SpeechBrainClassification {
  language: StringInferenceValue;
  emotion: EmotionInferenceValue;
  speakerId?: StringInferenceValue;
}

export class SpeechBrainSpeakerCount {
  speakerCount: NumberInferenceValue;
}

export class SpeechBrainSeparation {
  language?: StringInferenceValue;
  emotion?: EmotionInferenceValue;
  speakerCount: NumberInferenceValue;
}

export class SpeechBrainSpeakerVerification {
  similarities: [number | null];
  embeddings: StringInferenceValue;
}

export class SpeechBrainSimilarityMatrix {
  similarity_matrix: number[][];
}

export class SpeechBrainEmbeddings {
  embeddings: StringInferenceValue;
}
