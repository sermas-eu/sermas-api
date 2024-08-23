import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as FormData from 'form-data';
import { Emotion } from 'libs/sermas/sermas.dto';
import { SpeechBrainClassification } from './speechbrain.dto';

@Injectable()
export class SpeechBrainService {
  private readonly logger = new Logger(SpeechBrainService.name);

  constructor(private readonly config: ConfigService) {}

  mapEmotion(em: string): Emotion {
    switch (em) {
      case 'ang':
        return 'disgust';
      case 'hap':
        return 'happy';
      case 'sad':
        return 'surprise';
      case 'neu':
      default:
        return 'neutral';
    }
  }

  async classify(audio: Buffer): Promise<SpeechBrainClassification | null> {
    try {
      const form = new FormData();
      form.append('file', audio, {
        contentType: 'audio/wav',
        filename: 'audio.wav',
      });

      const url = this.config.get('SPEECHBRAIN_URL');

      const res = await axios.postForm(url, form);
      this.logger.log(
        `Speech classification result: '${JSON.stringify(res.data)}'`,
      );

      const result = res.data as SpeechBrainClassification;
      result.emotion.value = this.mapEmotion(result.emotion.value as string);

      return result;
    } catch (err) {
      this.logger.error(`Speech classification error: ${err.message}`);
    }
    return null;
  }
}
