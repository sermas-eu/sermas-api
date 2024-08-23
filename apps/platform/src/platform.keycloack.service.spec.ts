import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SermasBaseModule } from 'apps/api/src/sermas.base.module';
import { KeycloakService } from 'apps/keycloak/src/keycloak.service';
import { uuidv4 } from 'libs/dataset/src';
import { PlatformAppService } from './app/platform.app.service';
import { newApp } from './app/tests/app';
import { PlatformKeycloakService } from './platform.keycloack.service';
import { PlatformModule } from './platform.module';
import { PlatformTopicsService } from './topics/platform.topics.service';

jest.setTimeout(5 * 60 * 1000);

const newResources = ['module1.scopeA', 'module1.scopeB', 'module2.scopeC'];

describe('PlatformKeycloakService', () => {
  let moduleRef: TestingModule;

  let platformKeycloakService: PlatformKeycloakService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [SermasBaseModule, PlatformModule],
      controllers: [],
      providers: [],
    })
      .setLogger(new Logger())
      .compile();

    platformKeycloakService = moduleRef.get(PlatformKeycloakService);

    await moduleRef.init();

    const keycloakService = moduleRef.get(KeycloakService);

    await keycloakService.removeClientByName('test-app-');
    await keycloakService.removeUserByName('test-user-');
  });

  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  beforeEach(async () => {
    const platformTopicsService = moduleRef.get(PlatformTopicsService);
    platformTopicsService.removeFromResources(newResources);
  });

  describe('platform keycloak integration', () => {
    it('update platform client resources/scopes', async () => {
      // create client with defaults
      await platformKeycloakService.ensurePlatformClient();

      // add more resource.scopes to topics service
      const platformTopicsService = moduleRef.get(PlatformTopicsService);
      platformTopicsService.addFromResources(newResources);

      await platformKeycloakService.ensurePlatformClient();
    });

    it('update app client resources/scopes', async () => {
      const platformAppService = moduleRef.get(PlatformAppService);
      const keycloakService = moduleRef.get(KeycloakService);

      const appId = `test-app-${uuidv4()}`;
      const username = `test-user-${uuidv4()}`;
      const user = await platformAppService.saveUser({
        appId,
        username,
        email: `${username}@sermas.local`,
        password: username,
      });

      const app = await platformAppService.createApp(
        newApp(appId, user.id),
        false,
      );

      // create client with defaults
      let client = await platformKeycloakService.getAppClient(app.appId);
      const clientId1 = client.id;

      let resources = await keycloakService.getClientResources(client.id);

      const newResourcesMap: Record<string, string[]> = newResources
        .map((res) => res.split('.'))
        .reduce(
          (o, [resource, scope]) => ({
            ...o,
            [resource]: [...(o[resource] || []), scope],
          }),
          {},
        );

      expect(
        resources.filter(
          (r) =>
            newResourcesMap[r.name] &&
            (r.scopes || []).filter((s) =>
              newResourcesMap[r.name].includes(
                s.name.replace(`${r.name}:`, ''),
              ),
            ).length,
        ).length,
      ).toBeFalsy();

      // add more resource.scopes to topics service
      const platformTopicsService = moduleRef.get(PlatformTopicsService);
      platformTopicsService.addFromResources(newResources);

      client = await platformKeycloakService.ensureAppClient(
        app.appId,
        app.name,
      );
      const clientId2 = client.id;
      resources = await keycloakService.getClientResources(client.id);

      expect(clientId1).toBe(clientId2);

      expect(
        resources.filter(
          (r) =>
            newResourcesMap[r.name] &&
            (r.scopes || []).filter((s) =>
              newResourcesMap[r.name].includes(
                s.name.replace(`${r.name}:`, ''),
              ),
            ).length,
        ).length,
      ).toBeTruthy();
    });
  });
});
