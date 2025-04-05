import {
  BadRequestException,
  INestApplication,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import axios, { AxiosResponse } from 'axios';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import {
  AsyncApiDocument,
  AsyncApiDocumentBuilder,
  AsyncApiModule,
  AsyncOperationObject,
} from 'nestjs-asyncapi';
import OpenAPIClientAxios, {
  Document,
  OpenAPIClient,
  Operation,
} from 'openapi-client-axios';
import * as url from 'url';
import { SermasWellKnowDto } from '../platform.well-known.dto';
import {
  ASYNCAPI_BASEURL,
  ASYNCAPI_PUBLIC_URL,
  OPENAPI_BASEURL,
  OPENAPI_PUBLIC_URL,
  WELL_KNOWN_PATH,
} from './constants';
import { AsyncApiUtils } from './libs/asyncapi-utils';
import { SermasAsyncApiModule } from './libs/asyncapi.mod';
import {
  OpenApiUtils,
  PlatformModuleSwaggerOperation,
} from './libs/openapi-utils';
import { PlatformModuleAsyncApiService } from './mod.async.service';
import {
  ModuleConfigEventDto,
  ModuleResourceDto,
  ModuleSettingsDto,
  PlatformModuleConfigDto,
} from './mod.dto';
import { PlatformModuleRegistryService } from './mod.registry.service';

interface PlatformModuleWrapperOpenApi {
  client: OpenAPIClient;
  operation: Operation;
  spec: Document;
  swaggerOperation: PlatformModuleSwaggerOperation;
}

interface PlatformModuleWrapperAsyncApi {
  spec: AsyncApiDocument;
  operation: AsyncOperationObject;
  topic: string;
  type: string;
}

interface PlatformModuleWrapper {
  [operationId: string]: {
    resource: ModuleResourceDto;
    moduleId: string;
    openapi?: PlatformModuleWrapperOpenApi;
    asyncapi?: PlatformModuleWrapperAsyncApi;
  };
}

@Injectable()
export class PlatformModuleService implements OnModuleInit {
  private readonly logger = new Logger(PlatformModuleService.name);

  private readonly openapiUtils = new OpenApiUtils();
  private readonly asyncApiUtil = new AsyncApiUtils();

  private readonly moduleWrappers: {
    [moduleId: string]: PlatformModuleWrapper;
  } = {};

  private app: INestApplication;

  constructor(
    private readonly registry: PlatformModuleRegistryService,
    private readonly moduleAsync: PlatformModuleAsyncApiService,
    private readonly emitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    const modules = await this.registry.list();
    if (!modules.length) return;

    this.logger.debug(`Loading ${modules.length} modules`);
    await Promise.all(
      modules.map((moduleConfig) =>
        this.getModuleWrapper(moduleConfig.moduleId),
      ),
    );
  }

  @OnEvent('platform.mod.flush')
  onRegistryRemoveAll() {
    Object.keys(this.moduleWrappers).forEach((moduleId) =>
      this.removeModuleWrapper(moduleId),
    );
  }

  @OnEvent('platform.mod.remove')
  removeModuleWrapper(moduleId: string) {
    if (moduleId && this.moduleWrappers[moduleId])
      delete this.moduleWrappers[moduleId];
  }

  async setupApiDocs(app: INestApplication) {
    await this.setupOpenApi(app);
    await this.setupAsyncApi(app);
  }

  async setupOpenApi(app: INestApplication) {
    this.app = app;
    SwaggerModule.setup(OPENAPI_BASEURL, app, this.getOpenApiDocument(), {
      patchDocumentOnRequest: () => {
        return this.getOpenApiDocument();
      },
    });
  }

  async setupAsyncApi(app: INestApplication) {
    try {
      const asyncapiDocument = await this.getAsyncApiDocument();

      // console.warn(JSON.stringify(asyncapiDocument));

      await SermasAsyncApiModule.setup(
        ASYNCAPI_BASEURL,
        app,
        asyncapiDocument,
        undefined,
        {
          onRender: (doc: AsyncApiDocument) => this.getAsyncApiDocument(),
        },
      );
    } catch (e: any) {
      this.logger.error(`Failed to generate asyncApi docs: ${e.stack}`);
    }
  }

  async getAsyncApiDocument() {
    const app = this.app;
    this.app = app;

    const asyncApiOptions = new AsyncApiDocumentBuilder()
      .setTitle('Sermas Events')
      .setDescription('Sermas Events')
      .setVersion('1.0')
      .setDefaultContentType('application/json')
      .addBearerAuth()
      .addServer('sermas-broker', {
        url: ASYNCAPI_PUBLIC_URL,
        protocol: 'mqtt',
      })
      .build();

    const asyncapiDocument = await AsyncApiModule.createDocument(
      app,
      asyncApiOptions,
      {},
    );

    this.addPlatformModulesToAsyncApi(asyncapiDocument);

    return asyncapiDocument;
  }

  getOpenApiDocument() {
    const app = this.app;

    const config = new DocumentBuilder()
      .setTitle('SERMAS Toolkit')
      .setDescription('Documentation for the SERMAS Toolkit API')
      .setVersion('1.0')
      .addBearerAuth()
      .addServer(OPENAPI_PUBLIC_URL, 'API url')
      .build();

    const document = SwaggerModule.createDocument(app, config, {});

    for (const path in document.paths) {
      for (const method in document.paths[path]) {
        // console.log(document.paths[path][method])
        const tags = document.paths[path][method].tags || [];
        if (tags.length === 0) {
          // this.logger.debug(
          //   `Remove openAPI element with no tags: ${method.toUpperCase()} ${path}`,
          // );
          delete document.paths[path][method];
        }
      }
    }

    this.addPlatformModulesToOpenApi(document);

    return document;
  }

  addPlatformModulesToAsyncApi(document: AsyncApiDocument) {
    for (const moduleId in this.moduleWrappers) {
      const operations = this.moduleWrappers[moduleId];
      for (const operationId in operations) {
        const wrapper = this.moduleWrappers[moduleId][operationId];

        if (!wrapper.asyncapi) continue;

        const { operation, type, topic, spec } = wrapper.asyncapi;

        document.channels[topic] = document.channels[topic] || {};

        if (document.channels[topic][type]) {
          this.logger.warn(
            `Skip module ${wrapper.moduleId} topic ${type} ${topic} already exists.`,
          );
          continue;
        }

        this.logger.debug(`Add asyncAPI event for ${type} ${topic}`);

        const references = this.asyncApiUtil.extractSchemaReferences(spec);

        document.components = document.components || {};
        document.components.schemas = document.components.schemas || {};
        document.components.schemas = {
          ...document.components.schemas,
          ...references,
        };

        document.channels[topic][type] = operation;
      }
    }

    return document;
  }

  addPlatformModulesToOpenApi(document: OpenAPIObject) {
    // add external modules references to the API
    for (const moduleId in this.moduleWrappers) {
      const operations = this.moduleWrappers[moduleId];
      for (const operationId in operations) {
        const wrapper = this.moduleWrappers[moduleId][operationId];

        if (!wrapper.openapi?.swaggerOperation) continue;

        const { path, method } = wrapper.openapi?.swaggerOperation;

        this.logger.debug(
          `Add openAPI endpoint for ${method.toUpperCase()} /${moduleId}/${operationId}`,
        );

        const endpointPath = `/api/module/${moduleId}/${operationId}`;

        document.paths[endpointPath] = document.paths[endpointPath] || {};

        // const toPascalCase = (val: string) => {
        //   return val
        //     .replace(/([^a-z0-9-])/gi, '-')
        //     .split('-')
        //     .filter((s) => s.length > 0)
        //     .map((s) => s.substring(0, 1).toUpperCase() + s.substring(1))
        //     .join('');
        // };

        // const objectModuleId = toPascalCase(moduleId);
        const schemas = this.openapiUtils.getSchemaDefinitions(
          wrapper.openapi.spec,
        );

        // const mappedObjectNames = Object.keys(schemas).reduce(
        //   (o, name) => ({
        //     ...o,
        //     [name]: toPascalCase(`${objectModuleId}-${name}`),
        //   }),
        //   {} as Record<string, string>,
        // );

        document.components.schemas = {
          ...document.components.schemas,
          ...schemas,
        };
        // this.openapiUtils.replaceSchemas(document, mappedObjectNames);

        const moduleOperation: Operation = {
          // ...this.openapiUtils.replaceReferencesInOperation(
          //   wrapper.openapi?.swaggerOperation.operation,
          //   mappedObjectNames,
          // ),
          // operationId: `${objectModuleId}${toPascalCase(operationId)}`,
          ...wrapper.openapi?.swaggerOperation.operation,
          tags: [moduleId.toUpperCase()],
          operationId,
        };

        document.paths[endpointPath][method] = moduleOperation;
      }
    }

    return document;
  }

  async register(data: PlatformModuleConfigDto, user?: AuthJwtUser) {
    const exists = await this.get(data.moduleId, user);

    // validate
    if (!data.config) throw new BadRequestException('missing config');
    if (!data.config.resources || !data.config.resources.length)
      throw new BadRequestException('missing resources');

    // load
    this.moduleWrappers[data.moduleId] =
      this.moduleWrappers[data.moduleId] || {};

    const wrappers = await this.loadModuleConfig(data.moduleId, data.config);
    this.moduleWrappers[data.moduleId] = {
      ...this.moduleWrappers[data.moduleId],
      ...wrappers,
    };

    const mod = await this.registry.save(data);
    this.publishChanged(mod, exists ? 'updated' : 'created');

    this.logger.log(`Registered module ${mod.moduleId}`);

    return mod;
  }

  async getModuleWrapper(moduleId: string) {
    if (!this.moduleWrappers[moduleId]) {
      const module = await this.registry.get(moduleId);

      if (!module) return null;
      if (module.status === 'disabled' || module.status === 'failure') {
        return null;
      }

      try {
        this.moduleWrappers[moduleId] = await this.loadModuleConfig(
          moduleId,
          module.config,
        );
      } catch (e) {
        module.status = 'failure';
        this.logger.warn(`Failed to load module ${moduleId}, disabling`);
        await this.registry.save(module);
      }
    }
    return this.moduleWrappers[moduleId];
  }

  async loadWellKnown(baseUrl: string) {
    const wellKnownUrl = `${baseUrl}${WELL_KNOWN_PATH}`;
    try {
      const res = await axios.get<any, AxiosResponse<SermasWellKnowDto>>(
        wellKnownUrl,
      );
      return res.data;
    } catch (e: any) {
      this.logger.debug(`Failed to load ${wellKnownUrl}: ${e.message}`);
      return null;
    }
  }

  async loadModuleConfig(moduleId: string, config: ModuleSettingsDto) {
    const apiUrl = url.parse(
      config.url || config.openapiSpec || config.asyncapiSpec,
    );
    const baseURL = `${apiUrl.protocol}//${apiUrl.host}`;

    const wellKnown = await this.loadWellKnown(baseURL);
    if (wellKnown) {
      if (wellKnown.asyncapiSpec) {
        config.asyncapiSpec = wellKnown.asyncapiSpec.startsWith('http')
          ? wellKnown.asyncapiSpec
          : `${baseURL}${wellKnown.asyncapiSpec}`;
        this.logger.debug(
          `Using .well-knonw asyncapiSpec: ${config.asyncapiSpec}`,
        );
      }
      if (wellKnown.openapiSpec) {
        config.openapiSpec = wellKnown.openapiSpec.startsWith('http')
          ? wellKnown.openapiSpec
          : `${baseURL}${wellKnown.openapiSpec}`;
        this.logger.debug(
          `Using .well-knonw openapiSpec: ${config.openapiSpec}`,
        );
      }
    }

    if (!config.openapiSpec && !config.asyncapiSpec)
      throw new BadRequestException(
        'missing both openapiSpec and asyncapiSpec',
      );

    let api: OpenAPIClientAxios;
    if (config.openapiSpec) {
      try {
        api = new OpenAPIClientAxios({
          definition: config.openapiSpec,
          axiosConfigDefaults: { baseURL },
        });
        this.logger.debug(`Configure module, baseURL ${baseURL}`);
        await api.init();
      } catch (e: any) {
        throw new BadRequestException(
          `Failed to load the openapi spec at ${config.openapiSpec}: ${e.message}`,
        );
      }
    }

    let asyncApiDocument: AsyncApiDocument;
    if (config.asyncapiSpec) {
      try {
        const res = await axios.get(config.asyncapiSpec);
        asyncApiDocument = res.data;
        // console.log(JSON.stringify(asyncApiDocument, null, 2));
        this.logger.debug(
          `Loaded async configuration at ${config.asyncapiSpec}`,
        );
      } catch (e: any) {
        throw new BadRequestException(
          `Failed to load the asyncapi spec at ${config.asyncapiSpec}: ${e.message}`,
        );
      }
    }

    const moduleRequestWrapper: PlatformModuleWrapper = {};

    const client = await api?.getClient();
    for (const resource of config.resources) {
      if (!resource.operationId) continue;

      const apiOperation = api?.getOperation(resource.operationId);
      if (!apiOperation)
        throw new BadRequestException(
          `Missing operation ${resource.operationId} in openapi ${config.openapiSpec}`,
        );

      const operationId = resource.operationId;
      moduleRequestWrapper[operationId] = {
        openapi: {
          spec: api?.document,
          client,
          operation: apiOperation,
          swaggerOperation: this.openapiUtils.getOperationById(
            api?.document,
            operationId,
          ),
        },
        moduleId,
        resource,
      };

      // asyncapi
      if (asyncApiDocument) {
        for (const topic in asyncApiDocument.channels) {
          const channel = asyncApiDocument.channels[topic];

          for (const type of ['publish', 'subscribe']) {
            const operation: AsyncOperationObject = channel[type];
            if (!operation) continue;

            const operationId = operation.operationId;
            if (!operationId) continue;

            moduleRequestWrapper[operationId] = moduleRequestWrapper[
              operationId
            ] || {
              resource,
              moduleId,
            };

            const wrapper = moduleRequestWrapper[operationId];

            wrapper.asyncapi = {
              spec: asyncApiDocument,
              operation,
              topic,
              type,
            };
          }
        }
      }
    }

    return moduleRequestWrapper;
  }

  async reload(moduleId: string, user?: AuthJwtUser) {
    if (this.moduleWrappers[moduleId]) {
      delete this.moduleWrappers[moduleId];
    }
    await this.getModuleWrapper(moduleId);
    return this.get(moduleId);
  }

  async get(moduleId: string, user?: AuthJwtUser) {
    return this.registry.get(moduleId);
  }

  async remove(moduleId: string, user?: AuthJwtUser) {
    const record = await this.get(moduleId);
    if (!record) return;

    await this.registry.remove(moduleId);
    this.publishChanged(record, 'deleted');
  }

  publishChanged(
    record: PlatformModuleConfigDto,
    operation: SermasRecordChangedOperation,
  ) {
    const event: ModuleConfigEventDto = {
      ts: new Date(),
      operation,
      record,
    };
    this.emitter.emit('platform.module.changed', event);
    this.moduleAsync.moduleChanged(event);
  }
}
