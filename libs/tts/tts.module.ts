import { Global, Module } from '@nestjs/common';
import { MonitorModule } from '#libs/monitor/monitor.module';
import { GoogleTextToSpeech } from './providers/tts.google.provider.js';
import { SSMLService } from './ssml/ssml.service.js';
import { TTSProviderService } from './tts.provider.service.js';
import { AzureTextToSpeech } from './providers/tts.azure.provider.js';
import { OpenAITextToSpeech } from './providers/tts.openai.provider.js';

@Global()
@Module({
  imports: [MonitorModule],
  providers: [
    SSMLService,
    TTSProviderService,
    GoogleTextToSpeech,
    AzureTextToSpeech,
    OpenAITextToSpeech,
  ],
  exports: [TTSProviderService],
})
export class TTSModule {}
