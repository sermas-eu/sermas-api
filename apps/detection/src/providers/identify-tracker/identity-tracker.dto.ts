export class SessionEmbeddingsDto {
  speakerEmbedding: string;
  agentEmbedding: string;
  list: string[];
}

export class SpeakerVerificationDto {
  results: boolean[];
  embeddings: string;
}
