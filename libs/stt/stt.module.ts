import { Global, Module } from '@nestjs/common';
import { MonitorModule } from 'libs/monitor/monitor.module';
import { AzureSpeechToText } from './providers/stt.azure.service';
import { GoogleSpeechToText } from './providers/stt.google.service';
import { OpenAISpeechToText } from './providers/stt.openai.service';
import { WhisperSpeechToText } from './providers/stt.whisper.service';
import { STTProviderService } from './stt.provider.service';

@Global()
@Module({
  imports: [MonitorModule],
  providers: [
    GoogleSpeechToText,
    OpenAISpeechToText,
    WhisperSpeechToText,
    AzureSpeechToText,
    STTProviderService,
  ],
  exports: [STTProviderService],
})
export class STTModule {}
