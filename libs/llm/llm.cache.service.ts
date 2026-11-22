import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';
import { md5 } from '#libs/util';
import { Cache, createCache } from 'cache-manager';
import { Transform } from 'stream';
import { LLMMessage } from './providers/provider.dto.js';

/** Redis key prefix of cached LLM responses. */
export const LLM_CACHE_NAMESPACE = 'llm';

/**
 * Caches LLM responses in their own Redis namespace, so that clearing them
 * (CLEAR_CACHE_ON_START) leaves sessions and the other cached records alone.
 */
@Injectable()
export class LLMCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(LLMCacheService.name);

  private readonly enabled: boolean;
  private readonly cache: Cache;

  constructor(private readonly config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL');
    this.cache = createCache({
      ttl: (+config.get('CACHE_TTL_SEC') || 86400) * 1000,
      // no Redis (unit tests): in memory
      stores: redisUrl
        ? [createKeyv(redisUrl, { namespace: LLM_CACHE_NAMESPACE })]
        : undefined,
    });

    this.enabled = config.get('LLM_CACHE_ENABLED') !== '0';
    this.logger.log(`LLM caching ${this.enabled ? 'enabled' : 'disabled'}`);

    if (config.get('CLEAR_CACHE_ON_START') === '1') {
      this.logger.log('Clearing the LLM responses cache');
      this.cache
        .clear()
        .catch((e) =>
          this.logger.warn(`Failed to clear the LLM cache: ${e.message}`),
        );
    }
  }

  async onModuleDestroy() {
    await this.cache.disconnect().catch(() => undefined);
  }

  hashMessage(messages: LLMMessage[]) {
    return md5(JSON.stringify(messages));
  }

  async save(messages: LLMMessage[], data: any) {
    if (!this.enabled) return;
    await this.cache.set(this.hashMessage(messages), data);
  }

  async get(messages: LLMMessage[]) {
    if (!this.enabled) return null;
    return await this.cache.get(this.hashMessage(messages));
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
      const content = this.buffer.toString() || '';
      content
        .split('\n')
        .forEach((c) => this.logger.verbose(`CACHING RESPONSE ${c}`));

      this.addToCache();
      this.buffer = '';
    }
    callback();
  }
}
