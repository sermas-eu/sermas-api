import { Global, Module } from '@nestjs/common';
import { LLMProviderService } from './llm.provider.service';
import { LLMService } from './llm.service';
import { LLMCacheService } from './cache.service';

@Global()
@Module({
  imports: [],
  providers: [LLMService, LLMProviderService, LLMCacheService],
  exports: [LLMService, LLMProviderService],
})
export class LLMModule {}
