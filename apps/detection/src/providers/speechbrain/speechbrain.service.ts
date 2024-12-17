import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as FormData from 'form-data';
import { Emotion } from 'libs/sermas/sermas.dto';
import {
  SpeechBrainClassification,
  SpeechBrainSeparation,
  SpeechBrainSpeakerCount,
} from './speechbrain.dto';

@Injectable()
export class SpeechBrainService implements OnModuleInit {
  private readonly logger = new Logger(SpeechBrainService.name);

  private available: boolean | undefined;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.isAvailable();
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

  private async post<T>(path: string, data: FormData): Promise<T> {
    const avail = await this.isAvailable();
    if (!avail) return null;

    const url = this.config.get('SPEECHBRAIN_URL') + path;
    const res = await axios.postForm(url, data, {
      timeout: 2000,
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
}
