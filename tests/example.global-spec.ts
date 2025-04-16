import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'apps/api/src/app.module';
import { CliProgram } from '@sermas/cli/dist/cli';
import run from '@sermas/cli/dist/commands/app/batch';
import CommandParams from '@sermas/cli/dist/libs/dto/cli.dto';

describe('TTS (e2e)', () => {
  let app: INestApplication;
  let cli: CliProgram;
  const testPort: number = 3000; // Matches port expected by Caddyfile

  beforeAll(async () => {
    jest.setTimeout(15 * 1000);
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
      const commandParams: CommandParams = {
        flags: undefined,
        args: [],
        feature: undefined,
        command: new Command,
        program: new Command,
        api: new CliApi
      };
      const stats = run(commandParams);
      // Just a Dummy
      expect(stats).toEqual(42);
    },
    15 * 1000,
  );
});
