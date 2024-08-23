// Imports the Google Cloud client library
import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from 'libs/llm/llm.service';
import { ITextToSpeech, SpeakParam } from '../tts.dto';

@Injectable()
export class OpenAITextToSpeech implements ITextToSpeech {
  private readonly logger = new Logger(OpenAITextToSpeech.name);

  constructor(private readonly llm: LLMService) {}

  public async speak(params: SpeakParam): Promise<Buffer> {
    const voice = params.gender === 'M' ? 'alloy' : 'nova';
    const openai = this.llm.getOpenAIClient();

    if (!openai) {
      this.logger.error('OpenAI client is not available, check configuration');
      return Buffer.from([]);
    }

    const audio = await openai.audio.speech.create({
      model: 'tts-1',
      voice,
      input: params.text,
      response_format: 'wav',
    });
    return Buffer.from(await audio.arrayBuffer());
  }
}
