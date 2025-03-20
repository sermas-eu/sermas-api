import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { TTSModule } from '../libs/tts/tts.module';


describe('TTS (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, TTSModule],
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
