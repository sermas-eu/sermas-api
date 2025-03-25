import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TTSModule } from '../libs/tts/tts.module';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { SSMLService } from 'libs/tts/ssml/ssml.service';
import { TTSProviderService } from 'libs/tts/tts.provider.service';
import { BarkAITextToSpeech } from 'libs/tts/providers/tts.bark-ai.provider';
import { ElevenIOTextToSpeech } from 'libs/tts/providers/tts.elevenio.provider';
import { OpenAITextToSpeech } from 'libs/tts/providers/tts.openai.provider';
import { GoogleTextToSpeech } from 'libs/tts/providers/tts.google.provider';
import { AzureTextToSpeech } from 'libs/tts/providers/tts.azure.provider';
import { MonitorService } from 'libs/monitor/monitor.service';
import { LLMCacheService } from 'libs/llm/llm.cache.service';
import { CacheModule, CACHE_MANAGER } from '@nestjs/cache-manager';
import { SessionService } from 'apps/session/src/session.service';
import { LLMService } from 'libs/llm/llm.service';

describe('TTS (e2e)', () => {
  let app: INestApplication;

  // In your imports:
  CacheModule.register({
    ttl: 0, // Test configuration
    max: 0,
    isGlobal: true,
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        SSMLService,
        LLMProviderService,
        LLMCacheService,
        LLMService,
        TTSProviderService,
        BarkAITextToSpeech,
        ElevenIOTextToSpeech,
        OpenAITextToSpeech,
        GoogleTextToSpeech,
        AzureTextToSpeech,
        ConfigService,
        EventEmitter2,
        MonitorService,
        SessionService,
        // Mock CACHE_MANAGER
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            reset: jest.fn(),
            // Add other cache methods your service uses
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  it('should return 404 for non-existing route', () => {
    return request(app.getHttpServer())
      .post('/api/dialogue/speech/tts')
      .send({ text: 'Hello, world!' })
      .expect(404);
  });
});
