import { Emotion } from 'libs/sermas/sermas.dto';
import { LanguageCode } from '../language/lang-codes';
import { DialogueMessageDto } from '../language/dialogue.message.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface SpeakParam {
  text?: string;
  ssml?: string;
  languageCode?: LanguageCode;
  gender?: string;
  emotion?: Emotion;
}

export interface ITextToSpeech {
  speak(params: SpeakParam): Promise<Buffer> | Buffer;
}

export class DialogueTextToSpeechDto extends DialogueMessageDto {
  @ApiPropertyOptional({
    description:
      'Text to convert to speech. If emotion field is set, it will be converted to SSML. If also `ssml` field is set, this field will be ignored',
  })
  text: string | null;
  @ApiPropertyOptional({
    description: 'SSML markup to render as speech.',
  })
  ssml?: string;
  @ApiProperty()
  language: string | null;
  @ApiPropertyOptional()
  emotion?: Emotion;
}
