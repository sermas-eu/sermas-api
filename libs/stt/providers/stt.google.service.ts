// Imports the Google Cloud client library
import { type SpeechClient as GSpeechClient } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DefaultLanguage } from 'libs/language/lang-codes';
import { mapLanguageCode } from 'libs/language/language';
import { ISpeechToText, SpeechToTextResponse } from '../stt.dto';

@Injectable()
export class GoogleSpeechToText implements ISpeechToText {
  private readonly logger = new Logger(GoogleSpeechToText.name);

  private client: GSpeechClient;

  constructor(private readonly config: ConfigService) {}

  //
  // async load, avoid error if missing env.GOOGLE_APPLICATION_CREDENTIALS
  private async loadClient(): Promise<GSpeechClient | null> {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      this.logger.warn(
        `process.env.GOOGLE_APPLICATION_CREDENTIALS is missing. Cannot use google TTS/STT as a provider`,
      );
      return null;
    }

    if (!this.client) {
      const { SpeechClient } = await import('@google-cloud/speech');
      this.client = new SpeechClient();
    }
    return this.client;
  }

  public async text(
    content: Buffer,
    language: string,
  ): Promise<SpeechToTextResponse> {
    // Creates a client
    const client = await this.loadClient();
    if (!client)
      throw new InternalServerErrorException(
        `Failed to load google STT provider`,
      );

    // The audio file's encoding, sample rate in hertz, and BCP-47 language code
    const audio = {
      content,
    };

    let languageCode = language ? mapLanguageCode(language) : null;
    languageCode = languageCode || DefaultLanguage;
    const phrases = this.config
      .get<string>('STT_GOOGLE_IMPROVED_RECOGNITION')
      .split(',')
      .map((t) => t.trim());

    const request: google.cloud.speech.v1.IRecognizeRequest = {
      audio: audio,
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        audioChannelCount: 1,
        useEnhanced: true,
        model: 'command_and_search', // Better for short, clean commands
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false, // Set to true if you need timestamps
        languageCode,
        speechContexts: [
          {
            phrases,
          },
        ],
      },
    };

    // Detects speech in the audio file
    const [response] = await client.recognize(request);
    const text = response.results
      .map((result) => result.alternatives[0].transcript)
      .join('\n');

    return {
      text,
    };
  }
}
