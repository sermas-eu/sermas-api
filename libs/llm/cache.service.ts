import {
  Cache,
  CACHE_MANAGER,
  CacheKey,
  CacheTTL,
} from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transform } from 'stream';
import { LLMMessage } from './providers/provider.dto';
import {
  AnswerResponse,
  ToolResponse,
} from '../../apps/dialogue/src/avatar/dialogue.chat.tools.dto';
import { md5 } from 'libs/util';

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
    if (process.env.CLEAR_CACHE_ON_START) {
      this.logger.log('Clearing REDIS cache');
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
    await this.cacheManager.set(`${hash}`, data);
  }

  async get(messages: LLMMessage[]) {
    if (!this.enabled) return null;
    const hash = this.hashMessage(messages);
    return await this.cacheManager.get(`${hash}`);
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
    chunk: Buffer | string | AnswerResponse | ToolResponse,
    encoding: string,
    callback: CallableFunction,
  ) {
    chunk = chunk || '';

    const isBuffer = (chunk as Buffer).byteLength !== undefined;
    if (isBuffer) {
      chunk = chunk.toString();
    }

    if (typeof chunk === 'string') {
      this.buffer += chunk.toString();
    }

    this.push(chunk);
    callback();
  }

  addToCache() {
    this.cacheService.save(this.cacheKey, this.buffer);
  }

  _flush(callback: CallableFunction) {
    if (this.buffer.trim().length > 0) {
      this.logger.log(`saving ${this.buffer.toString()}`);
      this.addToCache();
      // this.push(this.buffer);
      this.buffer = '';
    }
    callback();
  }
}
