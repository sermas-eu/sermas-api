// Imports the Google Cloud client library
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { ISpeechToText, SpeechToTextResponse } from '../stt.dto.js';

@Injectable()
export class WhisperSpeechToText implements ISpeechToText {
  private readonly logger = new Logger(WhisperSpeechToText.name);

  constructor(private readonly config: ConfigService) {}

  public async text(
    raw: Buffer,
    language: string,
    contentType = 'application/octet-stream',
  ): Promise<SpeechToTextResponse> {
    const whisperUrl = this.config.get('WHISPER_URL');

    const asrMethod = 'openai-whisper';
    const asrTask = 'transcribe';
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

    // vad_filter: silence and noise come back as no text instead of Whisper's
    // hallucinated "Thank you." (faster-whisper; other engines ignore it)
    const url = `${whisperUrl}/asr?method=${asrMethod}&task=${asrTask}&encode=${asrEncode}&output=${asrOutput}&language=${asrLanguage}&vad_filter=true`;
    const res = await axios.postForm(url, form);

    return {
      text: res.data.text,
    };
  }
}
