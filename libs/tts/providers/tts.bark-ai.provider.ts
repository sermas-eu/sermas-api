// Imports the Google Cloud client library
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { stripTags } from '../ssml/util';
import { ITextToSpeech, SpeakParam } from '../tts.dto';
import { supportedLanguages } from '../utils/barkai-languages';

@Injectable()
export class BarkAITextToSpeech implements ITextToSpeech {
  private readonly logger = new Logger(BarkAITextToSpeech.name);

  private readonly url: string;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get('BARKAI_URL');
  }

  public async speak(params: SpeakParam): Promise<Buffer> {
    let text = params.text;
    if (!params.text && params.ssml) {
      text = stripTags(params.ssml);
    }

    const languageCode = params.languageCode;

    const language = languageCode.split('-')[0];
    if (!supportedLanguages.includes(language)) {
      throw new BadRequestException(
        `BarkAI does not support language ${languageCode} (${supportedLanguages.join(
          ', ',
        )})`,
      );
    }

    if (params.ssml && !text) {
      throw new BadRequestException(
        `BarkAI does not support SSML, please provide a text field`,
      );
    }

    if (!text)
      throw new BadRequestException(
        `Field text or ssml is required to perform TTS`,
      );

    const prompt = `[WOMAN] ${text}`;

    //TODO handle expressions by bark
    // https://github.com/suno-ai/bark#%EF%B8%8F-details
    // [laughter]
    // [laughs]
    // [sighs]
    // [music]
    // [gasps]
    // [clears throat]
    // — or ... for hesitations
    // ♪ for song lyrics
    // CAPITALIZATION for emphasis of a word
    // [MAN] and [WOMAN] to bias Bark toward male and female speakers, respectively

    const res = await axios.post(
      this.url,
      {
        prompt: prompt,
        language: languageCode,
      },
      {
        responseType: 'arraybuffer',
      },
    );

    return Buffer.from(res.data, 'binary');
  }
}
