import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'apps/api/src/app.module';
import * as path from 'path';
import { homedir } from 'os';
import cliBatchcommand from '@sermas/cli/dist/commands/app/batch';
import { CommandParams } from '@sermas/cli/dist/libs/dto/cli.dto';
import { CliApi } from '@sermas/cli/dist/libs/api/api.cli';
import { Command } from 'commander';
import { CliConfigHandler } from '@sermas/cli/dist/libs/api/config';
import { CliCredentialsHandler } from '@sermas/cli/dist/libs/api/credentials';

jest.mock('commander');

const configDir = process.env.CONFIG_DIR || path.resolve(homedir(), '.sermas');
const testPort: number = 3000; // Matches port expected by Caddyfile
const baseUrl = process.env.BASE_URL || `http://api:${testPort}`;
const credentialsFile = path.resolve(configDir, `credentials.json`);
const cliConfigFile = path.resolve(configDir, `cli.json`);

describe('TTS (e2e)', () => {
  let app: INestApplication;
  let cliApi: CliApi;

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

    const cliConfig = new CliConfigHandler(cliConfigFile);
    const cliCredentials = new CliCredentialsHandler(
      cliConfig,
      credentialsFile,
    );
    cliApi = new CliApi(cliConfig, cliCredentials, baseUrl);
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // it('should be defined', () => {
  //   expect(app).toBeDefined();
  // });

  // it('should return 404 for non-existing route', () => {
  //   return request(app.getHttpServer())
  //     .post('/api/dialogue/speech/tts')
  //     .send({ text: 'Hello, world!' })
  //     .expect(404);
  // });

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
      const args = ['./testapps/dinosaurs'];
      const flags = { name: 'basic-test', output: undefined };
      const commandParams: CommandParams = {
        flags,
        args,
        feature: undefined,
        command: new Command(),
        program: new Command(),
        api: cliApi,
      };
      const stats = await cliBatchcommand.run(commandParams);
      // Just a Dummy
      expect(stats).toEqual({});
    },
    15 * 1000,
  );
});
