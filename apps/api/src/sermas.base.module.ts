import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { redisStore } from 'cache-manager-redis-yet';
import { LLMModule } from 'libs/llm/llm.module';
import { LoggerMiddleware } from 'libs/middleware/logger.middleware';
import { MonitorModule } from 'libs/monitor/monitor.module';
import { STTModule } from 'libs/stt/stt.module';
import { LLMTranslationModule } from 'libs/translation/translation.module';
import { TTSModule } from 'libs/tts/tts.module';
import { getMongoDbUrl } from 'libs/util';
import { MinioModule } from 'nestjs-minio-client';
import { SermasConfigModule } from './sermas.config.module';

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
          store: redisStore,
          url: config.get('REDIS_URL'),
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
    MinioModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      // imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const minioUrl = configService.get<string>('MINIO_URL');
        let url: URL;
        try {
          url = new URL(minioUrl);
        } catch {}
        const useSSL =
          minioUrl.startsWith('https') || minioUrl.endsWith('.labs');

        return {
          isGlobal: true,
          endPoint: url?.hostname || minioUrl,
          port: url?.port ? +url.port : undefined,
          useSSL,
          accessKey: configService.get<string>('MINIO_ACCESSKEY'),
          secretKey: configService.get<string>('MINIO_SECRETKEY'),
        };
      },
    }),
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
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
