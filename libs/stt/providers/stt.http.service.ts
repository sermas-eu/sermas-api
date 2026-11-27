import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { ISpeechToText, SpeechToTextResponse } from '../stt.dto.js';

/**
 * Speech to text over a generic HTTP speech service:
 * `POST {STT_HTTP_URL}/v1/transcribe`, multipart with the `audio` file and an optional
 * two-letter `language`, answering `{ text }`. An empty text means silence.
 */
@Injectable()
export class HttpSpeechToText implements ISpeechToText {
  private readonly logger = new Logger(HttpSpeechToText.name);

  constructor(private readonly config: ConfigService) {}

  public async text(
    raw: Buffer,
    language: string,
    contentType = 'audio/wav',
  ): Promise<SpeechToTextResponse> {
    const baseUrl = (this.config.get<string>('STT_HTTP_URL') || '').replace(
      /\/+$/,
      '',
    );
    if (!baseUrl) throw new Error('STT_SERVICE=http needs STT_HTTP_URL');

    const form = new FormData();
    form.append('audio', raw, { contentType, filename: 'audio.wav' });

    const lang = (language || '').split('-')[0].toLowerCase();
    if (lang) form.append('language', lang);

    const res = await axios.postForm(`${baseUrl}/v1/transcribe`, form);

    return { text: res.data?.text || '' };
  }
}
