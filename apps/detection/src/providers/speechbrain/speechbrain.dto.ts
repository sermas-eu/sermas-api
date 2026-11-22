import {
  EmotionInferenceValue,
  StringInferenceValue,
} from '#libs/sermas/sermas.dto';

export class SpeechBrainClassification {
  language: StringInferenceValue;
  emotion: EmotionInferenceValue;
  speakerId?: StringInferenceValue;
}

export class SpeechBrainSpeakerVerification {
  similarities: (number | null)[];
  embeddings: string;
}

export class SpeechBrainSimilarityMatrix {
  similarity_matrix: number[][];
}

export class SpeechBrainEmbeddings {
  embeddings: string;
}
