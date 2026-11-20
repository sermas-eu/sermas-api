import { Global, Module } from '@nestjs/common';
import { LLMProviderService } from './llm.provider.service.js';
import { LLMService } from './llm.service.js';
import { LLMCacheService } from './llm.cache.service.js';

@Global()
@Module({
  imports: [],
  providers: [LLMService, LLMProviderService, LLMCacheService],
  exports: [LLMService, LLMProviderService],
})
export class LLMModule {}
