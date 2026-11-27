import { Global, Module } from '@nestjs/common';
import { MonitorModule } from '#libs/monitor/monitor.module';
import { AzureSpeechToText } from './providers/stt.azure.service.js';
import { GoogleSpeechToText } from './providers/stt.google.service.js';
import { HttpSpeechToText } from './providers/stt.http.service.js';
import { WhisperSpeechToText } from './providers/stt.whisper.service.js';
import { STTProviderService } from './stt.provider.service.js';

@Global()
@Module({
  imports: [MonitorModule],
  providers: [
    GoogleSpeechToText,
    WhisperSpeechToText,
    AzureSpeechToText,
    HttpSpeechToText,
    STTProviderService,
  ],
  exports: [STTProviderService],
})
export class STTModule {}
