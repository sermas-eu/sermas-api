import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import * as murmurHash from 'murmurhash-native';
import { LLMMessage } from './providers/provider.dto';
import { Transform } from 'stream';
import { AnswerResponse, ToolResponse } from './tools/tool.dto';

@Injectable()
export class LLMCacheService {
  private readonly logger = new Logger(LLMCacheService.name);

  private hashFunction: murmurHash.MurmurHashFnH;
  private cacheTTL = +process.env.CACHE_TTL_SEC || 86400;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    this.hashFunction = murmurHash.murmurHash128x86;
    this.cacheManager.reset();
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
    callback();
  }

  addToCache() {
    this.cacheService.save(this.cacheKey, this.buffer);
  }

  _flush(callback: CallableFunction) {
    if (this.buffer.trim().length > 0) {
      this.logger.log(`saving ${this.buffer.toString()}`);
      this.addToCache();
      this.push(this.buffer);
      this.buffer = '';
    }
    callback();
  }
}
