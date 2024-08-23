import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { WakeWordService } from './wake-word.service';

jest.setTimeout(10 * 1000);

describe('WakeWordService', () => {
  let wakeWordService: WakeWordService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [],
      providers: [WakeWordService],
    }).compile();
    wakeWordService = moduleRef.get(WakeWordService);
    await moduleRef.init();
  });
  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  describe('match words', () => {
    it('should match  a set of words', async () => {
      wakeWordService.setWakeWords(['ciao agent', 'hi agent', 'hello agent']);

      let res: string | null;

      res = await wakeWordService.match('ciao agent');
      expect(res).not.toBeNull();

      res = await wakeWordService.match(
        'in the middle of a talk we get hello agent',
      );
      expect(res).not.toBeNull();

      res = await wakeWordService.match('ehi agent');
      expect(res).not.toBeNull();

      res = await wakeWordService.match('what if we say hello');
      expect(res).toBeNull();

      res = await wakeWordService.match('ciao forrest');
      expect(res).toBeNull();
    });
  });
});
