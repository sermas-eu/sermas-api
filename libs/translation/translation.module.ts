import { Global, Module } from '@nestjs/common';
import { LLMModule } from 'libs/llm/llm.module';
import { LLMTranslationService } from './translation.service';

@Global()
@Module({
  imports: [LLMModule],
  providers: [LLMTranslationService],
  exports: [LLMTranslationService],
})
export class LLMTranslationModule {}
