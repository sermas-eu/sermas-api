import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { createKeyv } from '@keyv/redis';
import { LLMModule } from '#libs/llm/llm.module';
import { LoggerMiddleware } from '#libs/middleware/logger.middleware';
import { MonitorModule } from '#libs/monitor/monitor.module';
import { STTModule } from '#libs/stt/stt.module';
import { LLMTranslationModule } from '#libs/translation/translation.module';
import { TTSModule } from '#libs/tts/tts.module';
import { getMongoDbUrl } from '#libs/util';
import { StorageModule } from '#libs/storage/storage.module';
import { SermasConfigModule } from './sermas.config.module.js';

@Module({
  imports: [
    SermasConfigModule,
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return {
          ttl: config.get<number>('CACHE_TTL_SEC') * 1000,
          // createKeyv, not `new KeyvRedis`: the bare adapter does not round-trip
          // objects through cache-manager.
          stores: [createKeyv(config.get<string>('REDIS_URL'))],
        };
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: getMongoDbUrl(configService),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    StorageModule,
    LLMModule,
    LLMTranslationModule,
    TTSModule,
    STTModule,
    MonitorModule,
  ],
})
export class SermasBaseModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
