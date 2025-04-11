import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'apps/api/src/app.module';
import { CliProgram } from '@sermas/cli/dist/cli';
import { CliProgram } from '@sermas/cli/dist/cli/';

describe('TTS (e2e)', () => {
  let app: INestApplication;
  let cli: CliProgram;
  const testPort: number = 1979;

  beforeAll(async () => {
    jest.setTimeout(15 * 1000);
    process.env.BASE_URL = `http://localhost:${testPort}`;
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/sermas';
    process.env.MQTT_URL = 'localhost';
    process.env.CHROMA_URL = 'http://localhost:8007';
    process.env.MINIO_URL = 'http://localhost:9000';
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      providers: [],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(testPort);

    cli = new CliProgram();
    await cli.init();
  });

  afterEach(async () => {
    if (app) await app.close();
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

  // it(
  //   'should list apps',
  //   () => {
  //     // Just a Dummy
  //     expect(cli.parse(['--yaml', 'app', 'list'], { from: 'user' })).toEqual(
  //       42,
  //     );
  //   },
  //   10 * 1000,
  // );

  it(
    'should run poa tests',
    async () => {
      // Just a Dummy
      expect(
        await cli.parse(
          [
            '--log-level',
            'verbose',
            'app',
            'batch',
            '../../tmp/repository/labs/sermas-private/apps/poa',
          ],
          { from: 'user' },
        ),
      ).toEqual(42);
    },
    15 * 1000,
  );
});
