import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlatformTopicsService } from './platform.topics.service';

describe('PlatformTopicsService', () => {
  let moduleRef: TestingModule;

  let platformTopicsService: PlatformTopicsService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [],
      controllers: [],
      providers: [PlatformTopicsService],
    })
      .setLogger(new Logger())
      .compile();

    platformTopicsService = moduleRef.get(PlatformTopicsService);

    await moduleRef.init();
  });

  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  beforeEach(async () => {
    platformTopicsService.reset();
  });

  describe('platform topics', () => {
    it('toJSON', async () => {
      const res = platformTopicsService.toJSON();
      expect(res).toBeTruthy();
    });

    it('add topic', async () => {
      const resource = 'resource';
      const scope = 'scope';

      platformTopicsService.addResource(resource, scope, ['context']);

      const res = platformTopicsService.toJSON();
      expect(
        res.filter((el) => el.resource === resource && el.scope === scope)
          .length,
      ).toBeTruthy();
    });

    it('add many topics', async () => {
      const topics = [
        'resource1.scopeA',
        'resource1.scopeB',
        'resource2.scopeC',
      ];

      platformTopicsService.addFromResources(topics);

      const res = platformTopicsService.toJSON();

      const [resource, scope] = topics[0].split('.');
      expect(
        res.filter((el) => {
          return el.resource === resource && el.scope === scope;
        }).length,
      ).toBe(1);
    });

    it('remove topic', async () => {
      const r = 'resource';
      const s = 'scope';

      platformTopicsService.addResource(r, s, ['context']);
      platformTopicsService.remove(r, s);

      let res = platformTopicsService.toJSON();
      expect(res.filter((el) => el.resource === r).length).toBeFalsy();

      platformTopicsService.addResource(r, s, ['context']);
      platformTopicsService.remove(r);

      res = platformTopicsService.toJSON();
      expect(res.filter((el) => el.resource === r).length).toBeFalsy();
    });
  });
});
