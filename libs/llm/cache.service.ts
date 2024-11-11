import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import * as murmurHash from 'murmurhash-native';
import { LLMMessage } from './providers/provider.dto';

@Injectable()
export class LLMCacheService {
  private readonly logger = new Logger(LLMCacheService.name);

  private hashFunction: murmurHash.MurmurHashFnH;
  private cacheTTL = +process.env.CACHE_TTL_SEC || 86400;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    this.hashFunction = murmurHash.murmurHash128x86;
  }

  hashMessage(messages: LLMMessage[]) {
    return this.hashFunction(JSON.stringify(messages));
  }

  async save(messages: LLMMessage[], data: any) {
    const hash = this.hashMessage(messages);
    await this.cacheManager.set(`${hash}`, data, this.cacheTTL * 1000);
  }

  async get(messages: LLMMessage[]) {
    const hash = this.hashMessage(messages);
    return await this.cacheManager.get(`${hash}`);
  }
}
