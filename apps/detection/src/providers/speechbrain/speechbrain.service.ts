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
} from './speechbrain.dto';

@Injectable()
export class SpeechBrainService implements OnModuleInit {
  private readonly logger = new Logger(SpeechBrainService.name);

  private available: boolean | undefined;
  private similarityThreshold: number;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.isAvailable();
    this.similarityThreshold =
      +process.env['SPEECH_SIMILARITY_THRESHOLD'] || 0.25;
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

  private async isAvailable(): Promise<boolean> {
    if (this.available !== undefined) return this.available;

    try {
      const url = this.config.get('SPEECHBRAIN_URL');
      await axios.get(url, {
        timeout: 500,
      });
      this.available = true;
    } catch (e: any) {
      if (e.message.indexOf('timeout') === -1) {
        this.logger.debug(`healtcheck error: ${e.stack}`);
      }
      this.available = false;
    }
    this.logger.log(`Speechbrain ${this.available ? ' ' : 'NOT '}available`);
    return this.available;
  }

  private async post<T>(
    path: string,
    data: FormData,
    timeout = 2000,
  ): Promise<T> {
    const avail = await this.isAvailable();
    if (!avail) return null;

    const url = this.config.get('SPEECHBRAIN_URL') + path;
    const res = await axios.postForm(url, data, {
      timeout,
    });
    this.logger.log(`Speechbrain result: '${JSON.stringify(res.data)}'`);
    return res.data as T;
  }

  async classify(audio: Buffer): Promise<SpeechBrainClassification | null> {
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

  async verifySpeaker(
    audio: Buffer,
    embeddings: string,
  ): Promise<boolean | null> {
    try {
      const form = this.buildFormData(audio);
      form.append('embeddings', embeddings);

      const result = await this.post<SpeechBrainSpeakerVerification>(
        '/verify_speaker',
        form,
      );

      if (result === null || !result.similarity) return null;

      return result.similarity >= this.similarityThreshold;
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
}
