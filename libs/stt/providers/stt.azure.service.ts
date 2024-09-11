// Imports the Google Cloud client library
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISpeechToText, SpeechToTextResponse } from '../stt.dto';

import { DefaultLanguage } from 'libs/language/lang-codes';
import { mapLanguageCode } from 'libs/language/language';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

@Injectable()
export class AzureSpeechToText implements ISpeechToText {
  private readonly logger = new Logger(AzureSpeechToText.name);

  constructor(private readonly config: ConfigService) {}

  private async loadSpeechConfig(
    language: string,
  ): Promise<sdk.SpeechConfig | null> {
    const azureKey =
      this.config.get('STT_AZURE_KEY') || this.config.get('AZURE_KEY');
    const azureRegion =
      this.config.get('STT_AZURE_REGION') || this.config.get('AZURE_REGION');

    if (!azureKey || !azureRegion) {
      this.logger.warn(
        `process.env.STT_AZURE_KEY and process.env.STT_AZURE_REGION are missing. Cannot use azure STT as a provider`,
      );
      return null;
    }

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      azureKey,
      azureRegion,
    );

    speechConfig.speechRecognitionLanguage = language;
    return speechConfig;
  }

  public async text(
    content: Buffer,
    language: string,
  ): Promise<SpeechToTextResponse> {
    let languageCode = language ? mapLanguageCode(language) : null;
    languageCode = languageCode || DefaultLanguage;

    const speechConfig = await this.loadSpeechConfig(languageCode);
    if (!speechConfig)
      throw new InternalServerErrorException(`Azure STT is not configured`);

    const audioConfig = sdk.AudioConfig.fromWavFileInput(content);

    // TODO: cache clients by language ?
    const speechRecognizer = new sdk.SpeechRecognizer(
      speechConfig,
      audioConfig,
    );

    return new Promise((resolve, reject) => {
      speechRecognizer.recognizeOnceAsync((result) => {
        let success = false;

        let failureMessage = '';
        const response = {
          text: '',
        };

        switch (result.reason) {
          case sdk.ResultReason.RecognizedSpeech:
            response.text = result.text;
            success = true;
            break;
          case sdk.ResultReason.NoMatch:
            break;
          case sdk.ResultReason.Canceled:
            const cancellation = sdk.CancellationDetails.fromResult(result);
            failureMessage = `STT cancelled reason=${cancellation.reason} ErrorCode=${cancellation.ErrorCode} ErrorDetails=${cancellation.errorDetails}`;
            this.logger.error(failureMessage);
            break;
        }

        speechRecognizer.close();

        if (!success) return reject(new Error(failureMessage));

        resolve(response);
      });
    });
  }
}
