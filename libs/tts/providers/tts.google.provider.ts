// Imports the Google Cloud client library
import type { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as toBuffer from 'typedarray-to-buffer';
import { ITextToSpeech, SpeakParam } from '../tts.dto';

// { lang: { gender: [ model names ] } }
// { 'it-IT': { 'F': [ ... ] } }
type GoogleVoiceModels = Record<string, Record<string, string[]>>;

@Injectable()
export class GoogleTextToSpeech implements ITextToSpeech, OnModuleInit {
  private readonly logger = new Logger(GoogleTextToSpeech.name);

  private client: TextToSpeechClient;
  private voiceModels: GoogleVoiceModels;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.loadVoices();
  }

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
    try {
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
      this.logger.debug(`Loaded Google TTS voices`);
    } catch (e) {
      this.logger.error(`Failed to load Google TTS voices: ${e.message}`);
      this.logger.debug(e.stack);
    }
  }

  public async speak(params: SpeakParam): Promise<Buffer> {
    const client = await this.loadClient();
    if (!client)
      throw new InternalServerErrorException(
        `Failed to load google TTS provider`,
      );

    if (!this.voiceModels) await this.loadVoices();

    const modelType = this.config.get('GOOGLE_TTS_MODEL_TYPE') || 'Neural';

    const { text, ssml } = params;

    const languageCode = params.languageCode;

    const gender = params.gender || 'N';

    if (!ssml && !text)
      throw new BadRequestException(
        `Field text or ssml is required to perform TTS`,
      );

    // TTS model
    const defaultModelName = `${languageCode}-Wavenet-A`;
    let ttsModelName: string;

    if (params.model) {
      if (
        this.voiceModels[languageCode] &&
        this.voiceModels[languageCode][params.gender] &&
        this.voiceModels[languageCode][params.gender].indexOf(params.model) > -1
      ) {
        ttsModelName = params.model;
      } else {
        this.logger.warn(
          `TTS model ${params.model} is not available in Google TTS voices list`,
        );
      }
    }

    if (!ttsModelName) {
      // match the name of the model to one of those, use the model type set from config as default
      const preferredModels = Array.from(
        new Set([modelType, ...['Neural', 'Wavenet', 'Standard']]),
      );

      // NOTE: google STT does not support FEMALE voice on all models
      // https://cloud.google.com/text-to-speech/docs/voices

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
        this.logger.warn(
          `TTS model for languageCode=${languageCode} not found`,
        );
      }
    }

    if (!ttsModelName) {
      this.logger.warn(
        `Failed to load a TTS voice model, using default fallback`,
      );
      ttsModelName = defaultModelName;
    }

    this.logger.debug(
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
