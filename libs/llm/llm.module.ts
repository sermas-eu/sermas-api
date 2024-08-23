import { Global, Module } from '@nestjs/common';
import { LLMProviderService } from './llm.provider.service';
import { LLMService } from './llm.service';

@Global()
@Module({
  imports: [],
  providers: [LLMService, LLMProviderService],
  exports: [LLMService, LLMProviderService],
})
export class LLMModule {}
