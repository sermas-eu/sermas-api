import { Injectable, Logger } from '@nestjs/common';
import {
  SessionEmbeddingsDto,
  SpeakerVerificationDto,
} from './identity-tracker.dto';
import { SpeechBrainService } from '../speechbrain/speechbrain.service';

@Injectable()
export class IdentityTrackerService {
  private readonly logger = new Logger(IdentityTrackerService.name);

  private embeddings: Record<string, SessionEmbeddingsDto> = {};
  private minEmbeddingsNumber: number;
  private similarityThreshold: number;

  constructor(private readonly speechbrain: SpeechBrainService) {
    this.minEmbeddingsNumber = +process.env['MIN_EMBEDDINGS_NUMBER'] || 3;
    this.similarityThreshold =
      +process.env['SPEECH_SIMILARITY_THRESHOLD'] || 0.25;
    // this.test();
  }

  async test() {
    const a =
      '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';
    const b =
      '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';
    const c =
      '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';

    this.addSpeakerEmbedding('test', a);
    this.addSpeakerEmbedding('test', b);
    this.addSpeakerEmbedding('test', c);
    await this.process('test');

    const emb = this.getSpeakerEmbedding('test');
    this.logger.debug(`Result: ${emb == a}`);
    this.reset();
  }

  reset() {
    this.embeddings = {};
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
    if (this.getAgentEmbedding(sessionId) != '') return;
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
    } else if (this.embeddings[sessionId].speakerEmbedding != '') {
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
    if (this.embeddings[sessionId].speakerEmbedding != '') {
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
    let index = -1;
    // compare embeddings
    const res = await this.speechbrain.similarityMatrix(
      this.embeddings[sessionId].list,
    );
    if (!res || !res.similarity_matrix) return;
    // clear diagonal (self comparison)
    for (let i = 0; i < res.similarity_matrix.length; i++) {
      for (let j = 0; j < res.similarity_matrix.length; j++) {
        if (i == j) {
          res.similarity_matrix[i][j] = 0;
        }
      }
    }
    // search most matching embedding
    const sum = res.similarity_matrix.map((s) =>
      s.reduce((acc, r) => (r >= this.similarityThreshold ? r + acc : acc), 0),
    );
    let bigger = 0;
    for (let i = 0; i < sum.length; i++) {
      if (sum[i] > bigger) {
        bigger = sum[i];
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
    if (sc != null) {
      return {
        results: sc.similarities.map((s) => s >= this.similarityThreshold),
        embeddings: sc.embeddings.toString(),
      };
    }
    return null;
  }
}
