import { HttpServer, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { createAsyncApiDocument, serveAsyncApiDocument } from 'libs/asyncapi';
import { ModuleResourceDto, PlatformModuleConfigDto } from '../mod.dto';
import { PlatformModuleService } from '../mod.service';
import { TestCustomModuleController } from './test.custom-module.controller';

export const registerExternalModule = async (
  platformModuleService: PlatformModuleService,
  moduleId: string,
  port: number,
) => {
  const resource1: ModuleResourceDto = {
    moduleId,
    resource: 'stuff',
    scope: 'send',
    emitEvent: true,
    operationId: 'sendStuff',
  };

  const resource2: ModuleResourceDto = {
    moduleId,
    resource: 'stuff',
    scope: 'list',
    emitEvent: true,
    operationId: 'listAllStuff',
  };

  const mod: PlatformModuleConfigDto = {
    moduleId,
    name: moduleId,
    config: {
      url: `http://localhost:${port}`,
      resources: [resource1, resource2],
    },
    supports: [],
  };

  await platformModuleService.register(mod);

  return mod;
};

export const stopServer = (moduleHttpServer: HttpServer) => {
  try {
    if (moduleHttpServer) moduleHttpServer.close();
  } catch {
    //
  }
};

export const startServer = async (port?: number) => {
  const m = await Test.createTestingModule({
    controllers: [TestCustomModuleController],
  })
    .setLogger(new Logger())
    .compile();

  const app = m.createNestApplication({
    cors: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Test Module')
    .setDescription('test')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer(`http://localhost:${port}`)
    .build();

  const openapiDoc = SwaggerModule.createDocument(app, config, {});
  SwaggerModule.setup('/openapi', app, openapiDoc, {});

  const asyncDoc = createAsyncApiDocument(app, {
    title: 'Test AsyncAPI',
    description: 'Test AsyncAPI',
    version: '1.0',
  });
  serveAsyncApiDocument(app, '/asyncapi', () => asyncDoc);

  const server: HttpServer = await app.listen(port);
  const logger = new Logger();
  logger.warn(`test-mod listening on :${port}`);
  return server;
};
