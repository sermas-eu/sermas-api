import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';

export class DialogueSpeechToTextDto extends DialogueMessageDto {
  buffer: Buffer;
  mimetype: string;
  sampleRate?: number;
}

export interface SpeechToTextResponse {
  text: string;
}

export interface ISpeechToText {
  text(content: Buffer, language: string): Promise<SpeechToTextResponse>;
}
