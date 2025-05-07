import { CacheModule } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { SermasConfigModule } from 'apps/api/src/sermas.config.module';
import { redisStore } from 'cache-manager-redis-yet';
import { readFile } from 'fs/promises';
import { LLMModule } from 'libs/llm/llm.module';
import { MonitorModule } from 'libs/monitor/monitor.module';
import { DialogueVectorStoreService } from './dialogue.vectorstore.service';

jest.setTimeout(10 * 1000);

describe('DialogueVectorStoreService', () => {
  let moduleRef: TestingModule;
  let dialogueVectorStoreService: DialogueVectorStoreService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
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
        MonitorModule,
        EventEmitterModule.forRoot(),
        LLMModule,
      ],
      controllers: [],
      providers: [DialogueVectorStoreService],
    }).compile();

    moduleRef.useLogger(new Logger());

    dialogueVectorStoreService = moduleRef.get(DialogueVectorStoreService);
    await moduleRef.init();
  });
  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  describe('handle documents', () => {
    it('parse by sentence', async () => {
      const raw = await readFile(__dirname + '/tests/parser-sentence.txt');
      const text = raw.toString();
      const chunks = dialogueVectorStoreService.extractChunks(text);
      expect(chunks.length).toBeGreaterThan(10);
    });
    it('parse by single-line', async () => {
      const raw = await readFile(__dirname + '/tests/parser-one-line.txt');
      const text = raw.toString();
      const chunks = dialogueVectorStoreService.extractChunks(
        text,
        'single-line',
      );
      expect(chunks.length).toBe(4);
    });
    it('parse by double-line', async () => {
      const raw = await readFile(__dirname + '/tests/parser-two-line.txt');
      const text = raw.toString();
      const chunks = dialogueVectorStoreService.extractChunks(
        text,
        'double-line',
      );
      expect(chunks.length).toBe(4);
    });
  });
});
