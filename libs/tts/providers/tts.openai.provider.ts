import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ITextToSpeech, SpeakParam } from '../tts.dto.js';

/**
 * Parse `TTS_OPENAI_VOICES`: comma-separated `<lang>[-<gender>]=<voice>` entries,
 * such as `it-F=if_sara,it-M=im_nicola,en=af_heart`. `<lang>` is the language part
 * of the code (`it` for `it-IT`), `<gender>` is F, M or N.
 */
export const parseVoiceMap = (raw?: string): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const entry of (raw || '').split(',')) {
    const [key, voice] = entry.split('=').map((s) => s.trim());
    if (key && voice) map[key.toLowerCase()] = voice;
  }
  return map;
};

/** The voice for a language and gender: exact match, then language only, then the default. */
export const selectVoice = (
  map: Record<string, string>,
  languageCode: string | undefined,
  gender: string | undefined,
  fallback: string,
): string => {
  const lang = (languageCode || '').split('-')[0].toLowerCase();
  const g = (gender || '').toLowerCase();
  return map[`${lang}-${g}`] || map[lang] || fallback;
};

/**
 * Text to speech over the OpenAI audio API (`/v1/audio/speech`): OpenAI itself, or any
 * compatible server, such as a local Kokoro or a LiteLLM proxy.
 */
@Injectable()
export class OpenAITextToSpeech implements ITextToSpeech {
  private readonly logger = new Logger(OpenAITextToSpeech.name);
  private client?: OpenAI;

  constructor(private readonly config: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        baseURL: this.config.get('TTS_OPENAI_BASEURL') || undefined,
        // compatible local servers usually take any key
        apiKey: this.config.get('TTS_OPENAI_API_KEY') || 'none',
      });
    }
    return this.client;
  }

  async speak(params: SpeakParam): Promise<Buffer> {
    if (!params.text) return Buffer.from([]);

    // an avatar's `tts.model` names the voice
    const voice =
      params.model ||
      selectVoice(
        parseVoiceMap(this.config.get('TTS_OPENAI_VOICES')),
        params.languageCode,
        params.gender,
        this.config.get('TTS_OPENAI_VOICE') || 'alloy',
      );
    const model = this.config.get('TTS_OPENAI_MODEL') || 'tts-1';

    this.logger.verbose(`TTS model=${model} voice=${voice}`);

    const res = await this.getClient().audio.speech.create({
      model,
      voice: voice as OpenAI.Audio.SpeechCreateParams['voice'],
      input: params.text,
      response_format: 'mp3',
    });

    return Buffer.from(await res.arrayBuffer());
  }
}
