// Imports the Google Cloud client library
import type { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as toBuffer from 'typedarray-to-buffer';
import { ITextToSpeech, SpeakParam } from '../tts.dto';

type GoogleVoiceModels = Record<string, Record<string, string[]>>;

@Injectable()
export class GoogleTextToSpeech implements ITextToSpeech {
  private readonly logger = new Logger(GoogleTextToSpeech.name);

  private client: TextToSpeechClient;
  private voiceModels: GoogleVoiceModels;

  constructor(private readonly config: ConfigService) {}

  //
  // async load, avoid error if missing env.GOOGLE_APPLICATION_CREDENTIALS
  private async loadClient(): Promise<TextToSpeechClient | null> {
    const credentialsPath = this.config.get('GOOGLE_APPLICATION_CREDENTIALS');
    if (!credentialsPath) {
      this.logger.warn(
        `process.env.GOOGLE_APPLICATION_CREDENTIALS is missing. Cannot use google TTS/STT as a provider`,
      );
      return null;
    }

    if (!this.client) {
      const { TextToSpeechClient } = await import(
        '@google-cloud/text-to-speech'
      );
      // Creates a client
      this.client = new TextToSpeechClient();
    }

    return this.client;
  }

  async loadVoices() {
    const client = await this.loadClient();
    if (!client) return;

    const [models] = await client.listVoices({});

    this.voiceModels = {};

    models.voices.forEach((voice) => {
      const { languageCodes, name, ssmlGender } = voice;

      languageCodes.forEach((languageCode) => {
        let gender = ssmlGender.toString().substring(0, 1);
        gender = gender === 'M' || gender === 'F' ? gender : 'N';
        this.voiceModels[languageCode] = this.voiceModels[languageCode] || {};
        this.voiceModels[languageCode][gender] =
          this.voiceModels[languageCode][gender] || [];
        this.voiceModels[languageCode][gender].push(name);
      });
    });

    // console.log(this.voiceModels);
    // console.log(JSON.stringify(res1, null, 2));
  }

  public async speak(params: SpeakParam): Promise<Buffer> {
    const client = await this.loadClient();
    if (!client)
      throw new InternalServerErrorException(
        `Failed to load google TTS provider`,
      );

    if (!this.voiceModels) await this.loadVoices();

    const { text, ssml } = params;

    const languageCode = params.languageCode;

    const gender = params.gender || 'N';

    if (!ssml && !text)
      throw new BadRequestException(
        `Field text or ssml is required to perform TTS`,
      );

    // match the name of the model to one of those
    const preferredModels = ['Wavenet', 'Neural', 'Standard'];

    // NOTE: google STT does not support FEMALE voice on all models
    // https://cloud.google.com/text-to-speech/docs/voices

    // FEMALE model
    let ttsModelName = `${languageCode}-Wavenet-A`;

    if (this.voiceModels[languageCode]) {
      if (
        this.voiceModels[languageCode][gender] &&
        this.voiceModels[languageCode][gender].length
      ) {
        for (const preferredModel of preferredModels) {
          const index = this.voiceModels[languageCode][gender].findIndex(
            (model) => model.indexOf(preferredModel) > -1,
          );
          if (index === -1) continue;
          ttsModelName = this.voiceModels[languageCode][gender][index];
          break;
        }
      } else {
        this.logger.warn(`TTS model for gender=${gender} not found`);
      }
    } else {
      this.logger.warn(`TTS model for languageCode=${languageCode} not found`);
    }

    this.logger.verbose(
      `TTS model for languageCode=${languageCode} gender=${gender} ${ttsModelName}`,
    );

    // Construct the request
    const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
      {
        input: {
          ssml: ssml || undefined,
          text: ssml ? undefined : text,
        },
        // Select the language and SSML voice gender (optional)
        voice: {
          languageCode: languageCode,
          ssmlGender: params.gender === 'M' ? 'MALE' : 'FEMALE',
          name: ttsModelName,
        },
        // select the type of audio encoding
        audioConfig: { audioEncoding: 'MP3' },
      };

    // Performs the text-to-speech request
    const [res] = await client.synthesizeSpeech(request);

    return toBuffer(res.audioContent as Uint8Array);
  }
}
