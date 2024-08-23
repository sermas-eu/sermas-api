import { HttpServer, INestApplication, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SermasBaseModule } from 'apps/api/src/sermas.base.module';
import { KeycloakService } from 'apps/keycloak/src/keycloak.service';
import { uuidv4 } from 'libs/dataset/src';
import * as request from 'supertest';
import { PlatformAppService } from '../app/platform.app.service';
import { newApp } from '../app/tests/app';
import { PlatformModule } from '../platform.module';
import { PlatformModuleRegistryService } from './mod.registry.service';
import { PlatformModuleService } from './mod.service';
import { registerExternalModule, startServer, stopServer } from './tests/mod';

jest.setTimeout(5 * 60 * 1000);

describe('PlatformModuleService', () => {
  let moduleHttpServer: HttpServer;
  let app: INestApplication;
  let moduleRef: TestingModule;

  let platformModuleService: PlatformModuleService;
  let platformModuleRegistryService: PlatformModuleRegistryService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [SermasBaseModule, PlatformModule],
      controllers: [],
      providers: [],
    })
      .setLogger(new Logger())
      .compile();

    platformModuleRegistryService = moduleRef.get(
      PlatformModuleRegistryService,
    );
    platformModuleService = moduleRef.get(PlatformModuleService);

    app = moduleRef.createNestApplication({
      logger: new Logger(),
    });

    await app.init();

    const keycloakService = moduleRef.get(KeycloakService);
    await keycloakService.removeClientByName('test-');
    await keycloakService.removeUserByName('test-');
  });

  afterAll(async () => {
    stopServer(moduleHttpServer);
    if (platformModuleRegistryService)
      await platformModuleRegistryService.removeAll();
    if (app) await app.close();
  });

  describe('mod proxy', () => {
    it('proxy HTTP request', async () => {
      const port = 12312;
      moduleHttpServer = await startServer(port);
      const moduleId = `mymodule`;

      const requestModule = async (token, payload: any = {}) => {
        const res = await request(app.getHttpServer())
          .post(`/module/${mod.moduleId}/${resource.operationId}`)
          .send(payload)
          .set({
            Authorization: `Bearer ${token}`,
          });
        expect(res?.error).toBeFalsy();
        expect(res.body).toBeTruthy();
        expect(res.body.length).toBeTruthy();
        expect(res.body[0].myapp).toBeTruthy();
      };

      // 1. create admin user
      const platformAppService = app.get(PlatformAppService);
      const appId = `test-app-${uuidv4()}`;
      const adminUsername = `test-user-${uuidv4()}`;

      const keycloakService = app.get(KeycloakService);
      const adminUser = await platformAppService.saveUser({
        appId,
        username: adminUsername,
        email: `${adminUsername}@sermas.local`,
        password: adminUsername,
      });
      await platformAppService.setAdminRole(adminUser.id);

      // get token
      const adminToken = await keycloakService.login(
        adminUsername,
        adminUsername,
        keycloakService.getPlatformClientName(),
      );

      // 2. register platform module
      const mod = await registerExternalModule(
        platformModuleService,
        moduleId,
        port,
      );
      const resource = mod.config.resources[0];

      // 3. request module, with admin token
      await requestModule(adminToken.access_token);

      // 4. create user & app
      const username = `test-user-${uuidv4()}`;
      const user = await platformAppService.saveUser({
        appId,
        username,
        email: `${username}@sermas.local`,
        password: username,
      });

      const userToken = await keycloakService.login(username, username);

      const platformApp = newApp(appId, user.id);
      await platformAppService.createApp(platformApp, false);

      // 5. query platform module from app client
      await requestModule(userToken.access_token, {
        appId,
      });
    });
  });
});
