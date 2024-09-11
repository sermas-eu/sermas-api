// Imports the Google Cloud client library
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sema } from 'async-sema';
import axios, { AxiosError } from 'axios';
import { stripTags } from '../ssml/util';
import { ITextToSpeech, SpeakParam } from '../tts.dto';

@Injectable()
export class ElevenIOTextToSpeech implements ITextToSpeech {
  private readonly logger = new Logger(ElevenIOTextToSpeech.name);

  private readonly url: string;
  private readonly apiKey: string;

  private readonly modelIds: string[];
  private readonly modelId: number;

  private readonly voiceIds: string[];
  private readonly voiceId: number;

  private requestsLimit: number;
  private semaphore: Sema;

  constructor(private readonly config: ConfigService) {
    this.url = 'https://api.elevenlabs.io/v1/text-to-speech/';
    this.apiKey = this.config.get('ELEVENIO_APIKEY');
    if (!this.apiKey.length)
      this.logger.warn('No API key has been set for this service');

    // From https://api.elevenlabs.io/v1/models
    // still needs the api key
    this.modelIds = this.config.get('ELEVENIO_MODELS').split(',');
    this.modelId = 0;

    // From https://api.elevenlabs.io/v1/voices
    // or can be added through the https://elevenlabs.io interface in the "Voices" section
    this.voiceIds = this.config.get('ELEVENIO_VOICEIDS').split(',');
    this.voiceId = 0;

    // https://help.elevenlabs.io/hc/en-us/articles/14312733311761-How-many-requests-can-I-make-and-can-I-increase-it
    this.requestsLimit = 2;
    this.semaphore = new Sema(this.requestsLimit);
  }

  private async processRequest(params: SpeakParam): Promise<Buffer> {
    let text = params.text;
    if (!params.text && params.ssml) {
      text = stripTags(params.ssml);
    }

    if (!text)
      throw new BadRequestException(`Field text is required to perform TTS`);

    // https://elevenlabs.io/docs/api-reference/text-to-speech
    const body = {
      text,
      model_id: this.modelIds[this.modelId],
      voice_settings: {
        stability: 0.8,
        similarity_boost: 0.5,
        use_speaker_boost: true,
      },
    };

    try {
      const res = await axios.post(
        `${this.url}${this.voiceIds[this.voiceId]}`,
        body,
        {
          method: 'POST',
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          responseType: 'arraybuffer',
        },
      );

      return Buffer.from(res.data, 'binary');
    } catch (err) {
      const data = JSON.parse(
        String.fromCharCode.apply(
          null,
          new Uint8Array((err as AxiosError).response.data as any),
        ),
      );
      this.logger.error(data);
      throw err;
    } finally {
      this.semaphore.release();
    }
  }

  public async speak(params: SpeakParam): Promise<Buffer> {
    await this.semaphore.acquire();

    return await this.processRequest(params);
  }
}
