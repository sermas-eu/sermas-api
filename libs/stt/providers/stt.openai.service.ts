// Imports the Google Cloud client library
import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from 'libs/llm/llm.service';
import { ISpeechToText, SpeechToTextResponse } from '../stt.dto';

@Injectable()
export class OpenAISpeechToText implements ISpeechToText {
  private readonly logger = new Logger(OpenAISpeechToText.name);

  constructor(private readonly llm: LLMService) {}

  public async text(
    content: Buffer,
    language: string,
  ): Promise<SpeechToTextResponse> {
    const file = new Blob([content], {
      type: 'application/octet-stream',
    }) as any;
    file.name = 'audio.wav';
    file.lastModified = Date.now();

    const openai = this.llm.getOpenAIClient();

    if (!openai) {
      this.logger.error('OpenAI client is not available, check configuration');
      return {
        text: '',
      };
    }

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: language.split('-')[0],
    });

    return {
      text: transcription.text,
    };
  }
}
