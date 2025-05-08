import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as FormData from 'form-data';
import { Emotion } from 'libs/sermas/sermas.dto';
import {
  SpeechBrainClassification,
  SpeechBrainSpeakerVerification,
  SpeechBrainSeparation,
  SpeechBrainSpeakerCount,
  SpeechBrainSimilarityMatrix,
  SpeechBrainEmbeddings,
} from './speechbrain.dto';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class SpeechBrainService implements OnModuleInit {
  private readonly logger = new Logger(SpeechBrainService.name);

  private available: boolean | undefined;
  private callTimeout: number;

  constructor(private readonly config: ConfigService) {}

  @Interval(5 * 1000)
  async checkAvailability() {
    await this.isAvailable(true);
  }

  async onModuleInit() {
    await this.isAvailable();
    this.callTimeout = +(this.config.get('SPEECHBRAIN_TIMEOUT_MSEC') || 3000);
  }

  mapEmotion(em: string): Emotion {
    switch (em) {
      case 'ang':
        return 'disgust';
      case 'hap':
        return 'happy';
      case 'sad':
        return 'sad';
      case 'surprise':
        return 'surprise';
      case 'neu':
      default:
        return 'neutral';
    }
  }

  private buildFormData(audio: Buffer): FormData {
    const form = new FormData();
    form.append('file', audio, {
      contentType: 'audio/wav',
      filename: 'audio.wav',
    });
    return form;
  }

  private async isAvailable(force?: boolean): Promise<boolean> {
    if (force !== true && this.available !== undefined) return this.available;

    const url = this.config.get('SPEECHBRAIN_URL');

    try {
      await axios.get(url, {
        timeout: 500,
      });
      this.available = true;
    } catch (e: any) {
      if (e.message.indexOf('timeout') === -1 && !force) {
        this.logger.debug(`healtcheck error: ${e.message}`);
      }
      this.available = false;
    }

    if (!force) {
      this.logger[this.available ? 'log' : 'warn'](
        `Speechbrain ${this.available ? ' ' : 'NOT '}available at ${url}`,
      );
    }
    return this.available;
  }

  private async post<T>(path: string, data: FormData): Promise<T> {
    const avail = await this.isAvailable();
    if (!avail) return null;

    const url = this.config.get('SPEECHBRAIN_URL') + path;
    const res = await axios.postForm(url, data, {
      timeout: this.callTimeout,
    });
    // this.logger.verbose(`Speechbrain result: '${JSON.stringify(res.data)}'`);
    return res.data as T;
  }

  async classify(audio: Buffer): Promise<SpeechBrainClassification | null> {
    if (this.config.get('SENTIMENT_ANALYSIS') === '0') {
      return null;
    }

    try {
      const form = this.buildFormData(audio);

      const result = await this.post<SpeechBrainClassification>('/', form);

      if (result === null) return null;

      result.emotion.value = this.mapEmotion(result.emotion.value as string);
      return result;
    } catch (err) {
      this.logger.error(`Speech classification error: ${err.message}`);
    }
    return null;
  }

  async separate(audio: Buffer): Promise<SpeechBrainSeparation | null> {
    try {
      const form = this.buildFormData(audio);
      const result = await this.post<SpeechBrainSeparation>('/separate', form);
      if (result === null) return null;
      return result;
    } catch (err) {
      this.logger.error(`Speech separation error: ${err.message}`);
    }
    return null;
  }

  async countSpeakers(audio: Buffer): Promise<SpeechBrainSpeakerCount> {
    try {
      const form = this.buildFormData(audio);
      const result = await this.post<SpeechBrainSpeakerCount>(
        '/count_speakers',
        form,
      );
      if (result === null) return null;
      return result;
    } catch (err) {
      this.logger.error(`Speech speaker count error: ${err.message}`);
    }
    return null;
  }

  async verifySpeakers(
    audio: Buffer,
    embeddings: string[],
  ): Promise<SpeechBrainSpeakerVerification | null> {
    try {
      const form = this.buildFormData(audio);
      form.append('embeddings', JSON.stringify(embeddings));

      const result = await this.post<SpeechBrainSpeakerVerification>(
        '/verify_speakers',
        form,
      );

      if (result === null) return null;

      return result;
    } catch (err) {
      this.logger.error(`Speaker verify error: ${err.message}`);
    }
    return null;
  }

  async similarityMatrix(
    data: string[],
  ): Promise<SpeechBrainSimilarityMatrix | null> {
    try {
      const form = new FormData();
      form.append('embeddings', JSON.stringify(data));

      const result = await this.post<SpeechBrainSimilarityMatrix>(
        '/similarity_matrix',
        form,
      );

      if (result === null) return null;

      return result;
    } catch (err) {
      this.logger.error(`Similarity matrix error: ${err.message}`);
    }
    return null;
  }

  async createEmbeddings(audio: Buffer): Promise<SpeechBrainEmbeddings | null> {
    try {
      const form = this.buildFormData(audio);

      const result = await this.post<SpeechBrainEmbeddings>(
        '/create_embeddings',
        form,
      );

      if (result === null) return null;

      return result;
    } catch (err) {
      this.logger.error(`Speech create embeddings error: ${err.message}`);
    }
    return null;
  }
}
