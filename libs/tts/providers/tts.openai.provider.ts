// Imports the Google Cloud client library
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMService } from 'libs/llm/llm.service';
import { stripTags } from '../ssml/util';
import { ITextToSpeech, SpeakParam } from '../tts.dto';

type OpenaiVoiceModels =
  | 'alloy'
  | 'echo'
  | 'fable'
  | 'onyx'
  | 'nova'
  | 'shimmer';

@Injectable()
export class OpenAITextToSpeech implements ITextToSpeech {
  private readonly logger = new Logger(OpenAITextToSpeech.name);

  private readonly models: Record<string, OpenaiVoiceModels[]> = {
    M: ['alloy', 'echo', 'fable', 'onyx'],
    F: ['nova', 'shimmer'],
  };

  constructor(
    private readonly config: ConfigService,
    private readonly llm: LLMService,
  ) {}

  public async speak(params: SpeakParam): Promise<Buffer> {
    const gender = params.gender?.toUpperCase() === 'M' ? 'M' : 'F';
    const models = this.models[gender];

    const openaiVoiceModel =
      params.model || this.config.get(`OPENAI_TTS_VOICE_${gender}`);

    let voice = models[0];

    if (openaiVoiceModel) {
      const idx = models.indexOf(openaiVoiceModel as OpenaiVoiceModels);
      if (idx > -1) {
        voice = models[idx];
      }
    }

    const openai = this.llm.getOpenAIClient();

    if (!openai) {
      this.logger.error('OpenAI client is not available, check configuration');
      return Buffer.from([]);
    }

    const model =
      this.config.get('OPENAI_TTS_MODEL') === 'tts-1' ? 'tts-1' : 'tts-1-hd';

    let text = params.text;
    if (!params.text && params.ssml) {
      text = stripTags(params.ssml);
    }

    const audio = await openai.audio.speech.create({
      model,
      voice,
      input: text,
      response_format: 'wav',
    });
    return Buffer.from(await audio.arrayBuffer());
  }
}
