import {
  Cache,
  CACHE_MANAGER,
  CacheKey,
  CacheTTL,
} from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { md5 } from 'libs/util';
import { Transform } from 'stream';
import { LLMMessage } from './providers/provider.dto';

const cacheTTL = +process.env.CACHE_TTL_SEC || 86400;

@Injectable()
@CacheTTL(cacheTTL)
@CacheKey('llm')
export class LLMCacheService {
  private readonly logger = new Logger(LLMCacheService.name);

  private enabled = true;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly config: ConfigService,
  ) {
    if (config.get('CLEAR_CACHE_ON_START') === '1') {
      this.logger.log('Clearing REDIS LLM responses cache');
      this.cacheManager.reset();
    }
    this.enabled = config.get('LLM_CACHE_ENABLED') !== '0';
    this.logger.log(`LLM caching ${this.enabled ? 'enabled' : 'disabled'}`);
  }

  hashMessage(messages: LLMMessage[]) {
    return md5(JSON.stringify(messages));
  }

  async save(messages: LLMMessage[], data: any) {
    if (!this.enabled) return;
    const hash = this.hashMessage(messages);
    await this.cacheManager.set(hash, data);
  }

  async get(messages: LLMMessage[]) {
    if (!this.enabled) return null;
    const hash = this.hashMessage(messages);
    return await this.cacheManager.get(hash);
  }
}

export class SaveToCacheTransformer extends Transform {
  private readonly logger = new Logger(SaveToCacheTransformer.name);

  private cacheService: LLMCacheService;
  private cacheKey: LLMMessage[];
  private buffer = '';

  constructor(
    cacheService: LLMCacheService,
    cacheKey: LLMMessage[],
    options?: any,
  ) {
    super({
      ...options,
      objectMode: true,
    });
    this.cacheService = cacheService;
    this.cacheKey = cacheKey;
  }

  _transform(
    chunk: Buffer | string,
    encoding: string,
    callback: CallableFunction,
  ) {
    chunk = (chunk || '').toString();
    this.buffer += chunk;
    this.push(chunk);
    callback();
  }

  addToCache() {
    this.cacheService.save(this.cacheKey, this.buffer);
  }

  _flush(callback: CallableFunction) {
    if (this.buffer.trim().length > 0) {
      this.logger.verbose(`caching response=${this.buffer.toString()}`);
      this.addToCache();
      this.buffer = '';
    }
    callback();
  }
}
