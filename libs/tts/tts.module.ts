import { Global, Module } from '@nestjs/common';
import { MonitorModule } from 'libs/monitor/monitor.module';
import { BarkAITextToSpeech } from './providers/tts.bark-ai.provider';
import { ElevenIOTextToSpeech } from './providers/tts.elevenio.provider';
import { GoogleTextToSpeech } from './providers/tts.google.provider';
import { OpenAITextToSpeech } from './providers/tts.openai.provider';
import { SSMLService } from './ssml/ssml.service';
import { TTSProviderService } from './tts.provider.service';

@Global()
@Module({
  imports: [MonitorModule],
  providers: [
    SSMLService,
    TTSProviderService,
    BarkAITextToSpeech,
    ElevenIOTextToSpeech,
    OpenAITextToSpeech,
    GoogleTextToSpeech,
  ],
  exports: [TTSProviderService],
})
export class TTSModule {}
