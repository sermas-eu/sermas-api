import { Injectable, Logger } from '@nestjs/common';
import {
  SessionEmbeddingsDto,
  SpeakerVerificationDto,
} from './identity-tracker.dto';
import { SpeechBrainService } from '../speechbrain/speechbrain.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IdentityTrackerService {
  private readonly logger = new Logger(IdentityTrackerService.name);

  private embeddings: Record<string, SessionEmbeddingsDto> = {};
  private minEmbeddingsNumber: number;
  private similarityThreshold: number;

  constructor(
    private readonly speechbrain: SpeechBrainService,
    private readonly configService: ConfigService,
  ) {
    this.minEmbeddingsNumber =
      +this.configService.get('MIN_EMBEDDINGS_NUMBER') || 3;
    this.similarityThreshold =
      +this.configService.get('SPEECH_SIMILARITY_THRESHOLD') || 0.25;
  }

  reset() {
    this.embeddings = {};
  }

  clearSessionEmbeddings(sessionId: string) {
    this.logger.debug(`Clear embedding for sessionId=${sessionId}`);
    if (typeof this.embeddings[sessionId] === 'undefined') {
      return;
    }
    delete this.embeddings[sessionId];
  }

  getSpeakerEmbedding(sessionId: string) {
    if (typeof this.embeddings[sessionId] === 'undefined') {
      return '';
    }
    return this.embeddings[sessionId].speakerEmbedding;
  }

  getAgentEmbedding(sessionId: string) {
    if (typeof this.embeddings[sessionId] === 'undefined') {
      return '';
    }
    return this.embeddings[sessionId].agentEmbedding;
  }

  async agentSpeech(sessionId: string, audio: Buffer): Promise<void> {
    if (this.getAgentEmbedding(sessionId) !== '') return;
    const sc = await this.speechbrain.createEmbeddings(audio);
    if (!sc) return;
    this.addAgentEmbedding(sessionId, sc.embeddings.toString());
  }

  async update(sessionId: string, embedding: string) {
    this.addSpeakerEmbedding(sessionId, embedding.toString());
    this.process(sessionId);
  }

  initEmbeddings(sessionId: string) {
    this.embeddings[sessionId] = {
      speakerEmbedding: '',
      agentEmbedding: '',
      list: [],
    } as SessionEmbeddingsDto;
  }

  addSpeakerEmbedding(sessionId: string, embedding: string) {
    if (typeof this.embeddings[sessionId] === 'undefined') {
      this.initEmbeddings(sessionId);
    } else if (this.embeddings[sessionId].speakerEmbedding !== '') {
      return;
    }
    this.embeddings[sessionId].list.push(embedding);
  }

  addAgentEmbedding(sessionId: string, embedding: string) {
    if (typeof this.embeddings[sessionId] === 'undefined') {
      this.initEmbeddings(sessionId);
    }
    this.logger.debug(`Saving agent embedding for sessionId=${sessionId}`);
    this.embeddings[sessionId].agentEmbedding = embedding;
  }

  async process(sessionId: string) {
    if (this.embeddings[sessionId].speakerEmbedding !== '') {
      return;
    }
    if (this.embeddings[sessionId].list.length < this.minEmbeddingsNumber) {
      return;
    }
    let index = 0;
    if (this.minEmbeddingsNumber > 1) {
      index = await this.findDominantEmbedding(sessionId);
    }
    if (index > -1) {
      this.logger.debug(`Saving speaker embedding for sessionId=${sessionId}`);
      // save embedding and use it to verify the speaker
      this.embeddings[sessionId].speakerEmbedding =
        this.embeddings[sessionId].list[index];
    } else {
      this.logger.debug(`Not matching embeddings for sessionId=${sessionId}`);
      // remove first embedding and process again when a new one arrives
      this.embeddings[sessionId].list.shift();
    }
  }

  async findDominantEmbedding(sessionId: string): Promise<number> {
    // compare embeddings
    const res = await this.speechbrain.similarityMatrix(
      this.embeddings[sessionId].list,
    );
    if (!res || !res.similarity_matrix) return;

    // Find the central embedding (the one with the highest similarity to most of the others)
    let index = -1;
    let biggest = 1.0; // Each row sums up to at least 1.0
    for (let i = 0; i < res.similarity_matrix.length; i++) {
      // Note: no need to exclude the 1.0 on the diagonal (it is added to both sides)
      const rowSum = res.similarity_matrix[i].reduce(
        (acc, r) => (r >= this.similarityThreshold ? r + acc : acc),
        0,
      );
      if (rowSum > biggest) {
        biggest = rowSum;
        index = i;
      }
    }
    return index;
  }

  async verifySpeaker(
    audio: Buffer,
    embeddings: string[],
  ): Promise<SpeakerVerificationDto | null> {
    const sc = await this.speechbrain.verifySpeakers(audio, embeddings);
    if (sc !== null) {
      return {
        results: sc.similarities.map((s) => s >= this.similarityThreshold),
        embeddings: sc.embeddings.toString(),
      };
    }
    return null;
  }
}
