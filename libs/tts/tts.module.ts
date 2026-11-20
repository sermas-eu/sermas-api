import { Global, Module } from '@nestjs/common';
import { MonitorModule } from 'libs/monitor/monitor.module';
import { GoogleTextToSpeech } from './providers/tts.google.provider';
import { SSMLService } from './ssml/ssml.service';
import { TTSProviderService } from './tts.provider.service';
import { AzureTextToSpeech } from './providers/tts.azure.provider';

@Global()
@Module({
  imports: [MonitorModule],
  providers: [
    SSMLService,
    TTSProviderService,
    GoogleTextToSpeech,
    AzureTextToSpeech,
  ],
  exports: [TTSProviderService],
})
export class TTSModule {}
