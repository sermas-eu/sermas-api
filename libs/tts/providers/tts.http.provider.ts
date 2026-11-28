import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ITextToSpeech, SpeakParam } from '../tts.dto.js';
import { parseVoiceMap, selectVoice } from './tts.openai.provider.js';

/** The two-letter language for a code such as `it-IT`, if the service supports it. */
export const supportedLanguage = (
  languageCode: string | undefined,
  supported: string,
): string | undefined => {
  const lang = (languageCode || '').split('-')[0].toLowerCase();
  const list = supported
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return lang && list.includes(lang) ? lang : undefined;
};

/**
 * Text to speech over a generic HTTP speech service:
 * `POST {TTS_HTTP_URL}/v1/synthesize` with JSON `{text, language, voice}`, answering
 * with a WAV, returned as it is: browsers play WAV, and encoding would only add latency.
 */
@Injectable()
export class HttpTextToSpeech implements ITextToSpeech {
  private readonly logger = new Logger(HttpTextToSpeech.name);

  constructor(private readonly config: ConfigService) {}

  async speak(params: SpeakParam): Promise<Buffer> {
    if (!params.text) return Buffer.from([]);

    const baseUrl = (this.config.get<string>('TTS_HTTP_URL') || '').replace(
      /\/+$/,
      '',
    );
    if (!baseUrl) throw new Error('TTS_SERVICE=http needs TTS_HTTP_URL');

    const supported = this.config.get<string>('TTS_HTTP_LANGUAGES') || 'it,en';
    const language = supportedLanguage(params.languageCode, supported);
    if (!language)
      throw new Error(
        `TTS_SERVICE=http does not support language=${params.languageCode} (supported: ${supported})`,
      );

    // an avatar's `tts.model` names the voice; empty means the service default
    const voice =
      params.model ||
      selectVoice(
        parseVoiceMap(this.config.get('TTS_HTTP_VOICES')),
        params.languageCode,
        params.gender,
        this.config.get('TTS_HTTP_VOICE') || '',
      ) ||
      null;

    this.logger.verbose(`TTS language=${language} voice=${voice || 'default'}`);

    const res = await axios.post<ArrayBuffer>(
      `${baseUrl}/v1/synthesize`,
      { text: params.text, language, voice },
      { responseType: 'arraybuffer' },
    );

    return Buffer.from(res.data);
  }
}
