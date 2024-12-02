// Imports the Google Cloud client library
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as FormData from 'form-data';
import { ISpeechToText, SpeechToTextResponse } from '../stt.dto';

@Injectable()
export class MmsSpeechToText implements ISpeechToText {
  private readonly logger = new Logger(MmsSpeechToText.name);

  constructor(private readonly config: ConfigService) {}

  public async text(
    raw: Buffer,
    language: string,
    contentType = 'application/octet-stream',
  ): Promise<SpeechToTextResponse> {
    const mmsUrl = this.config.get('MMS_URL');

    const asrEncode = 'true';
    const asrOutput = 'json';

    let asrLanguage = language || '';
    if (asrLanguage && asrLanguage.indexOf('-') > -1)
      asrLanguage = asrLanguage.toString().split('-')[0];

    const form = new FormData();
    form.append('audio_file', raw, {
      contentType,
      filename: 'audio.wav',
    });
    form.append('type', contentType);

    const url = `${mmsUrl}/asr?encode=${asrEncode}&output=${asrOutput}&language=${asrLanguage}`;
    const res = await axios.postForm(url, form);

    return {
      text: res.data.text,
    };
  }
}
