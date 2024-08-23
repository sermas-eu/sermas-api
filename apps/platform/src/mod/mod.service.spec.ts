import { HttpServer, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SermasBaseModule } from 'apps/api/src/sermas.base.module';
import { PlatformModule } from '../platform.module';
import { PlatformModuleProxyService } from './mod.proxy.service';
import { PlatformModuleRegistryService } from './mod.registry.service';
import { PlatformModuleService } from './mod.service';
import { registerExternalModule, startServer, stopServer } from './tests/mod';

jest.setTimeout(5 * 60 * 1000);

describe('PlatformModuleService', () => {
  let moduleHttpServer: HttpServer;
  let moduleRef: TestingModule;

  let platformModuleProxyService: PlatformModuleProxyService;
  let platformModuleService: PlatformModuleService;
  let platformModuleRegistryService: PlatformModuleRegistryService;

  const port = 12312;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [SermasBaseModule, PlatformModule],
      controllers: [],
      providers: [],
    })
      .setLogger(new Logger())
      .compile();

    platformModuleProxyService = moduleRef.get(PlatformModuleProxyService);
    platformModuleRegistryService = moduleRef.get(
      PlatformModuleRegistryService,
    );
    platformModuleService = moduleRef.get(PlatformModuleService);
    await moduleRef.init();

    moduleHttpServer = await startServer(port);
  });

  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
    stopServer(moduleHttpServer);
  });

  beforeEach(async () => {
    if (platformModuleRegistryService) {
      await platformModuleRegistryService.removeAll();
    }
  });

  describe('manage modules', () => {
    it('modules management', async () => {
      //

      const appId = 'my-app-id';
      const moduleId = `mymodule`;

      const mod = await registerExternalModule(
        platformModuleService,
        moduleId,
        port,
      );
      const resource = mod.config.resources[0];

      const result = await platformModuleProxyService.proxy({
        moduleId,
        operationId: resource.operationId,
        qs: {
          foo: 1,
        },
        params: {
          appId,
        },
        body: {
          appId,
          hello: 'world',
        },
      });

      expect(result).toBeTruthy();
      expect(result.myapp).toBe(true);
    });

    it('generate module openapi', async () => {
      //

      const moduleId = `mymodule`;
      const mod = await registerExternalModule(
        platformModuleService,
        moduleId,
        port,
      );

      const app = moduleRef.createNestApplication({
        // logger: new Logger(),
      });

      platformModuleService.setupOpenApi(app);
      const doc = platformModuleService.getOpenApiDocument();

      // console.log(JSON.stringify(doc, null, 2));

      expect(doc.components?.schemas).not.toBeFalsy();
      expect(doc.components?.schemas['TestStuff']).not.toBeFalsy();
    });

    it('generate module asyncapi', async () => {
      //
      const moduleId = `mymodule`;
      const mod = await registerExternalModule(
        platformModuleService,
        moduleId,
        port,
      );

      const app = moduleRef.createNestApplication({
        // logger: new Logger(),
      });

      await platformModuleService.setupApiDocs(app);
      const doc = await platformModuleService.getAsyncApiDocument();

      // console.log(JSON.stringify(doc, null, 2));

      // expect(doc.components?.schemas).not.toBeFalsy();
      // expect(doc.components?.schemas['MymoduleTestStuff']).not.toBeFalsy();
    });
  });
});
