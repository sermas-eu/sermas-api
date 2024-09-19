import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import * as toBuffer from 'typedarray-to-buffer';
import { ITextToSpeech, SpeakParam } from '../tts.dto';
import { fixSSML } from '../ssml/util';

// { lang: { gender: [ model names ] } }
// { 'it-IT': { 'F': [ ... ] } }
type AzureVoiceModels = Record<string, Record<string, string[]>>;

@Injectable()
export class AzureTextToSpeech implements ITextToSpeech, OnModuleInit {
  private readonly logger = new Logger(AzureTextToSpeech.name);

  private voices: AzureVoiceModels = {};

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.loadVoiceModels();
  }

  private async loadSpeechConfig(
    language?: string,
  ): Promise<sdk.SpeechConfig | null> {
    const azureKey =
      this.config.get('TTS_AZURE_KEY') || this.config.get('AZURE_KEY');
    const azureRegion =
      this.config.get('TTS_AZURE_REGION') || this.config.get('AZURE_REGION');

    if (!azureKey || !azureRegion) {
      this.logger.warn(
        `process.env.TTS_AZURE_KEY and process.env.TTS_AZURE_REGION are missing. Cannot use azure TTS as a provider`,
      );
      return null;
    }

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      azureKey,
      azureRegion,
    );

    if (language) {
      speechConfig.speechRecognitionLanguage = language;
    }

    // mp3
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz64KBitRateMonoMp3;

    return speechConfig;
  }

  async loadVoiceModels(): Promise<AzureVoiceModels> {
    const speechConfig = await this.loadSpeechConfig();
    if (!speechConfig) {
      this.logger.verbose(`Missing speech config, skip loading voice models`);
      return this.voices;
    }

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
    const result = await synthesizer.getVoicesAsync();

    if (result.reason !== sdk.ResultReason.VoicesListRetrieved) {
      this.logger.warn(`Voice retrieval failed: ${result.errorDetails}`);
      return this.voices;
    }

    const voices = result.voices;

    voices.forEach((voice) => {
      this.voices[voice.locale] = this.voices[voice.locale] || {};

      const gender = voice.gender === 1 ? 'F' : voice.gender === 2 ? 'M' : 'N';
      this.voices[voice.locale][gender] =
        this.voices[voice.locale][gender] || [];
      this.voices[voice.locale][gender].push(voice.shortName);
    });

    return this.voices;
  }

  public async speak(params: SpeakParam): Promise<Buffer> {
    let { text, ssml } = params;

    const languageCode = params.languageCode;

    const speechConfig = await this.loadSpeechConfig(languageCode);
    if (!speechConfig) throw new Error(`TTS speech config is not configured.`);

    const gender = params.gender || 'N';

    if (!ssml && !text)
      throw new BadRequestException(
        `Field text or ssml is required to perform TTS`,
      );

    // TTS model
    let defaultModelName = 'en-GB-RyanNeural';

    if (this.voices && this.voices[languageCode]) {
      if (
        this.voices[languageCode][gender] &&
        this.voices[languageCode][gender].length
      ) {
        defaultModelName = this.voices[languageCode][gender][0];
      } else {
        if (
          this.voices[languageCode]['F'] &&
          this.voices[languageCode]['F'].length
        ) {
          defaultModelName = this.voices[languageCode]['F'][0];
        }
      }
    }

    let ttsModelName: string;

    if (params.model) {
      ttsModelName = params.model;
    }

    if (!ttsModelName) {
      ttsModelName = defaultModelName;
    }

    this.logger.debug(
      `TTS model for languageCode=${languageCode} gender=${gender} ${ttsModelName}`,
    );

    if (ssml) {
      const ssmlCheck = await fixSSML(ssml, text);
      if (!ssmlCheck.ssml) {
        ssml = '';
        text = text || ssmlCheck.text;
      }
    }

    speechConfig.speechSynthesisVoiceName = ttsModelName;
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

    // convert callback function to promise
    return await new Promise((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        (result) => {
          const { audioData } = result;
          synthesizer.close();
          resolve(toBuffer(audioData));
        },
        (error) => {
          synthesizer.close();
          this.logger.error(`TTS failed ${error}`);
          reject(new Error(error));
        },
      );
    });
  }
}
