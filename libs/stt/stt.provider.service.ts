import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { DefaultLanguage } from 'libs/language/lang-codes';
import { MonitorService } from 'libs/monitor/monitor.service';
import { AzureSpeechToText } from './providers/stt.azure.service';
import { GoogleSpeechToText } from './providers/stt.google.service';
import { MmsSpeechToText } from './providers/stt.mms.service';
import { OpenAISpeechToText } from './providers/stt.openai.service';
import { OraiSpeechToText } from './providers/stt.orai.service';
import { WhisperSpeechToText } from './providers/stt.whisper.service';
import { DialogueSpeechToTextDto } from './stt.dto';

export type STTResponse = {
  provider: string;
  text: string;
  dialogueMessagePayload: DialogueMessageDto;
};

@Injectable()
export class STTProviderService {
  private readonly logger = new Logger(STTProviderService.name);

  constructor(
    private readonly googlestt: GoogleSpeechToText,
    private readonly openaistt: OpenAISpeechToText,
    private readonly whisperstt: WhisperSpeechToText,
    private readonly azurestt: AzureSpeechToText,
    private readonly mmsstt: MmsSpeechToText,
    private readonly oraistt: OraiSpeechToText,

    private readonly configService: ConfigService,

    private readonly monitor: MonitorService,
  ) {}

  async convertToText(payload: DialogueSpeechToTextDto): Promise<STTResponse> {
    const { buffer, language } = payload;

    const provider = this.configService.get('STT_SERVICE');
    let text = '';

    this.logger.verbose(
      `Processing speech input with ${provider} language=${language}`,
    );

    const perf = this.monitor.performance({
      ...payload,
      label: 'stt',
    });

    const dialogueMessagePayload: DialogueMessageDto = {
      ...payload,
      actor: 'agent',
      text: '',
      ts: payload.ts || new Date(),
      language: language || DefaultLanguage,
    };

    if (dialogueMessagePayload['buffer'])
      delete dialogueMessagePayload['buffer'];

    let response;
    try {
      switch (provider) {
        case 'google':
          // // convert to wav
          // buffer = await convertRawToWav(buffer);
          response = await this.googlestt.text(buffer, language);
          perf('google');
          break;
        case 'azure':
          response = await this.azurestt.text(buffer, language);
          perf('azure');
          break;
        case 'whisper':
          response = await this.whisperstt.text(buffer, language);
          perf('whisper');
          break;
        case 'mms':
          response = await this.mmsstt.text(buffer, language);
          perf('mms');
          break;
        case 'orai':
          response = await this.oraistt.text(buffer, language);
          perf('orai');
          break;
        case 'openai':
        default:
          response = await this.openaistt.text(buffer, language);
          perf('openai');
          break;
      }
      text = response.text;
    } catch (e) {
      this.logger.error(`STT failed: ${e.stack}`);

      throw { language, dialogueMessagePayload };
    }

    return { provider, text, dialogueMessagePayload };
  }
}
