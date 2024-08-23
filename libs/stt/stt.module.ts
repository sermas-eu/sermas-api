import { Global, Module } from '@nestjs/common';
import { STTProviderService } from './stt.provider.service';
import { GoogleSpeechToText } from './providers/stt.google.service';
import { OpenAISpeechToText } from './providers/stt.openai.service';
import { WhisperSpeechToText } from './providers/stt.whisper.service';
import { MonitorModule } from 'libs/monitor/monitor.module';

@Global()
@Module({
  imports: [MonitorModule],
  providers: [
    GoogleSpeechToText,
    OpenAISpeechToText,
    WhisperSpeechToText,
    STTProviderService,
  ],
  exports: [STTProviderService],
})
export class STTModule {}
