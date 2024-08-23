import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SermasBaseModule } from 'apps/api/src/sermas.base.module';
import { KeycloakModule } from 'apps/keycloak/src/keycloak.module';
import { KeycloakService } from 'apps/keycloak/src/keycloak.service';
import { uuidv4 } from 'libs/dataset/src';
import { KEYCLOACK_TEST_REALM } from 'libs/test';
import { PlatformModule } from '../platform.module';
import { PlatformAppService } from './platform.app.service';
import { newApp } from './tests/app';

const realm = KEYCLOACK_TEST_REALM;

jest.setTimeout(5 * 60 * 1000);

describe('PlatformAppService', () => {
  let moduleRef: TestingModule;

  let platformAppService: PlatformAppService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [SermasBaseModule, KeycloakModule, PlatformModule],
      controllers: [],
      providers: [],
    }).compile();

    moduleRef.useLogger(new Logger());

    platformAppService = moduleRef.get(PlatformAppService);
    const keycloakService = moduleRef.get(KeycloakService);

    keycloakService.setRealm(realm);

    await moduleRef.init();

    const apps = await platformAppService.listPublicApps();
    await Promise.all(
      apps.map((app) => platformAppService.removeApp(app.appId, false)),
    );

    await keycloakService.removeClientByName('test-app-');
    await keycloakService.removeUserByName('test-user-');
  });
  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  describe('manage apps', () => {
    it('should create a user', async () => {
      const appId = `test-app-${uuidv4()}`;
      const username = `test-user-${uuidv4()}`;
      const user = await platformAppService.saveUser({
        appId,
        username,
        email: `${username}@sermas.local`,
        password: username,
      });

      const app = newApp(appId, user.id);
      await platformAppService.createApp({
        data: app,
        skipClients: false,
      });
    });

    it('should create a user with admin role', async () => {
      const appId = `test-app-${uuidv4()}`;
      const username = `test-user-${uuidv4()}`;
      const user = await platformAppService.saveUser({
        appId,
        username,
        email: `${username}@sermas.local`,
        password: username,
      });

      await platformAppService.setAdminRole(user.id);
    });
    // it('should import apps', async () => {
    //   const appId = `test-app-${uuidv4()}`;

    //   const apps: PlatformAppDto[] = [
    //     {
    //       appId,
    //       name: appId,
    //       ownerId: 'user1',
    //       modules: [],
    //       repository: {
    //         avatars: {},
    //         backgrounds: {},
    //       },
    //       clients: [
    //         {
    //           clientId: 'client-test-1',
    //           permissions: ['dialogue.messages', 'detection.noise'],
    //         },
    //       ],
    //     },
    //   ];

    //   const importedApps = await platformAppService.importApps(apps, false);
    //   expect(importedApps.length).toBe(apps.length);
    // });
  });
});
