import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { RegistrationRequestDto } from 'apps/auth/src/auth.dto';
import { KeycloakUserRecord } from 'apps/keycloak/src/keycloak.admin.dto';
import { createHash } from 'crypto';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import { getConfigPath } from 'libs/sermas/sermas.utils';
import { isNodeEnv, loadFile, toDTO, uuidv4 } from 'libs/util';
import { FilterQuery, Model } from 'mongoose';
import {
  APP_CLIENT_NAME,
  PlatformKeycloakService,
} from '../platform.keycloack.service';
import { PlatformAppAsyncApiService } from './platform.app.async.service';
import { RepositoryDefaults } from './platform.app.defaults';
import {
  AppModuleConfigDto,
  AppSettingsDto,
  AppToolsDTO,
  PlatformAppChangedDto,
  PlatformAppDto,
  PlatformAppExportFilterDto,
} from './platform.app.dto';
import { PlatformApp, PlatformAppDocument } from './platform.app.schema';

@Injectable()
export class PlatformAppService implements OnModuleInit {
  private readonly logger = new Logger(PlatformAppService.name);

  constructor(
    @InjectModel(PlatformApp.name) private platformApp: Model<PlatformApp>,
    private asyncApi: PlatformAppAsyncApiService,
    private keycloack: PlatformKeycloakService,
    private config: ConfigService,
    private emitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    // await this.reimportApps(false);

    const importApps = this.config.get('APPS_IMPORT') === '1';
    const skipClients = this.config.get('APPS_RECREATE_CLIENTS') !== '1';

    if (!importApps) return;
    if (isNodeEnv('development')) {
      await this.reimportApps(skipClients);
    } else {
      await this.importAppsFromFile(`${getConfigPath()}/apps.json`);
    }
  }

  async reimportApps(skipClient = true) {
    await this.removeApps({}, skipClient);
    await this.importAppsFromFile(`${getConfigPath()}/apps.json`, skipClient);
  }

  async importAppsFromFile(filepath: string, skipClients?: boolean) {
    const apps = await loadFile<PlatformAppDto[]>(filepath);
    return await this.importApps(apps, skipClients);
  }

  async createImportUser(username?: string) {
    username = username || this.config.get('IMPORT_USER');
    try {
      const adminUser = await this.keycloack.getUser(username);
      if (adminUser) return adminUser;
    } catch {}

    const user = await this.keycloack.saveUser({
      email: `${username}@sermas.local`,
      password: createHash('sha256')
        .update(`${performance.now()}-${Math.random()}`)
        .digest('hex'),
      username,
      appId: undefined,
      firstName: ' ',
      lastName: ' ',
    });

    return user;
  }

  async exportApps(filter: PlatformAppExportFilterDto) {
    const q: FilterQuery<PlatformApp> = {};

    if (filter.appId && filter.appId.length) {
      q.appId = filter.appId;
    }

    if (filter.name && filter.name.length) {
      q.name = { $regex: filter.name, $options: 'i' };
    }

    const apps = await this.searchApps(q);

    for (const app of apps) {
      if (!app.clients) continue;
      for (const client of app.clients) {
        if (client.secret) continue;
        client.secret = await this.keycloack.getClientSecret(
          app.appId,
          client.clientId,
        );
      }
    }

    return apps;
  }

  async importApps(
    apps: PlatformAppDto[],
    skipClients?: boolean,
  ): Promise<PlatformAppDto[]> {
    const tmpUser = await this.createImportUser();
    const imported: PlatformAppDto[] = [];
    for (const importApp of apps) {
      try {
        const exists = await this.loadApp(importApp.appId);
        let savedApp: PlatformAppDto;

        // create a tmp user to import new app or use the existing ownerId if it does not exists
        let importAppUser: KeycloakUserRecord;
        if (importApp.ownerId) {
          importAppUser = await this.keycloack.getUserById(importApp.ownerId);
        }

        if (!importAppUser) {
          this.logger.debug(
            `Set tmp userId=${tmpUser.id} for appId=${importApp.appId}`,
          );
          importApp.ownerId = tmpUser.id;
        }

        if (exists) {
          savedApp = await this.updateApp({
            data: importApp,
            skipClients,
            isImport: true,
          });
        } else {
          savedApp = await this.createApp({
            data: importApp,
            skipClients,
          });
        }
        imported.push(savedApp);

        await this.publishApp(
          { rag: importApp.rag, ...savedApp },
          exists ? 'updated' : 'created',
        );

        this.logger.log(
          `Imported "${savedApp.name}" with appId=${savedApp.appId}`,
        );
      } catch (e: any) {
        this.logger.error(`Import failed appId=${importApp.appId}: ${e.stack}`);
      }
    }
    return imported;
  }

  async publishApp(
    app: PlatformAppDto,
    operation: SermasRecordChangedOperation,
  ) {
    const ev: PlatformAppChangedDto = {
      record: toDTO(app),
      appId: app.appId,
      operation,
      clientId: null,
      ts: new Date(),
    };

    this.emitter.emit('platform.app', ev);
    this.asyncApi.appChanged(ev);
  }

  async loadApp(appId: string): Promise<PlatformAppDocument | null> {
    const app = await this.platformApp.findOne({ appId }).exec();
    return app || null;
  }

  async removeApps(query?: PlatformAppExportFilterDto, skipClients = false) {
    const filter: FilterQuery<PlatformApp> = {};

    if (query) {
      if (query.appId && query.appId.length) {
        filter.appId = query.appId;
      }
      if (query.name) {
        filter.name = query.name;
      }
    }

    const apps = await this.platformApp.find(filter).exec();
    for (const app of apps) {
      await this.removeApp(app.appId, skipClients);
    }
  }

  async removeApp(appId: string, skipClients = false): Promise<void> {
    const app = await this.loadApp(appId);
    if (!app) return;

    if (!skipClients) {
      await Promise.all(
        app.clients.map((c) =>
          this.keycloack.removeAppModuleClient(app.appId, c.clientId),
        ),
      );
      // remove app client
      await this.keycloack.removeAppModuleClient(app.appId, APP_CLIENT_NAME);
      await this.keycloack.removeUserApps(app.ownerId, appId);
    }

    await this.platformApp.deleteOne({ appId }).exec();
    await this.publishApp(app, 'deleted');
  }

  async readApp(appId: string, failIfNotFound = true): Promise<PlatformAppDto> {
    const doc = await this.loadApp(appId);
    if (!doc) {
      if (failIfNotFound) throw new NotFoundException();
      else return null;
    }

    const app = toDTO(doc);

    return app;
  }

  ensureRepositoryDefaults(data: Partial<PlatformAppDto>) {
    const baseRepository = { ...RepositoryDefaults };

    data.repository = data.repository || { ...baseRepository };

    // default avatar
    data.repository.avatars = data.repository.avatars || [];
    if (!data.repository.avatars?.length) {
      data.repository.avatars.push(...baseRepository.avatars);
    }

    // default backgrounds
    data.repository.backgrounds = data.repository.backgrounds || [];
    if (!data.repository.backgrounds?.length) {
      data.repository.backgrounds.push(...baseRepository.backgrounds);
    }
  }

  async createApp(req: {
    data: Partial<PlatformAppDto>;
    skipClients?: boolean;
  }): Promise<PlatformAppDto> {
    const { data } = req;
    const skipClients = req.skipClients === undefined ? false : req.skipClients;

    if (!data.ownerId) throw new BadRequestException('Missing ownerId');

    if (data.appId) {
      if (data.appId === 'default') {
        throw new BadRequestException(`Cannot use default as appId`);
      }

      const exists = await this.loadApp(data.appId);
      if (exists) throw new ConflictException('appId already exists');
    }

    data.appId = data.appId || uuidv4();
    data.updatedAt = data.createdAt = new Date();

    data.clients = data.clients || [];
    data.modules = data.modules || [];

    const app = new this.platformApp(data);
    await app.save();

    // insert clients and modules
    const updateApp = {
      ...toDTO(app),
      ...{
        modules: data.modules,
        clients: data.clients,
        tools: data.tools,
        tasks: data.tasks,
      },
    };

    const updatedApp = await this.updateApp({
      data: updateApp,
      skipClients,
    });

    return toDTO(updatedApp);
  }

  async updateAppTools(appId: string, tools: AppToolsDTO[]) {
    if (!appId) throw new BadRequestException();
    if (!tools) throw new BadRequestException();

    const app = await this.loadApp(appId);
    if (!app) throw new NotFoundException();

    app.tools = tools;

    await app.save();
    this.publishApp(toDTO(app), 'updated');
  }

  async updateAppSettings(appId: string, settings: AppSettingsDto) {
    if (!appId) throw new BadRequestException();
    if (!settings) throw new BadRequestException();

    const app = await this.loadApp(appId);
    if (!app) throw new NotFoundException();

    app.settings = settings;

    await app.save();
    this.publishApp(toDTO(app), 'updated');
  }

  async getAppRepository(appId: string, type?: string, name?: string) {
    if (!appId) throw new BadRequestException();
    const app = await this.readApp(appId);
    if (!type) {
      return app.repository || {};
    }
    if (!name) {
      app.repository[type] || {};
    }
    if (!app.repository[type][name]) {
      throw new NotFoundException(`${name} not found in ${type}`);
    }
    return app.repository[type][name];
  }

  async updateApp(req: {
    data: Partial<PlatformAppDto>;
    skipClients?: boolean;
    isImport?: boolean;
  }): Promise<PlatformAppDto> {
    const { data } = req;
    const skipClients = req.skipClients === undefined ? false : req.skipClients;

    if (!data.appId) throw new BadRequestException();

    const app = await this.loadApp(data.appId);
    if (!app) throw new NotFoundException();

    if (data.name) app.name = data.name;
    if (data.description) app.description = data.description;
    if (data.repository) app.repository = data.repository;
    if (data.settings) app.settings = data.settings;
    if (data.tools) app.tools = data.tools;
    if (data.tasks) app.tasks = data.tasks;
    if (data.public !== undefined) app.public = data.public;

    if (data.ownerId) {
      // allow override on import
      if (req.isImport === true) {
        app.ownerId = data.ownerId;
      } else {
        // if previous user does not exists, update with the one provided
        try {
          await this.keycloack.getUserById(app.ownerId);
        } catch (e: any) {
          this.logger.warn(
            `App userId=${app.ownerId} does not exists: ${e.message}`,
          );
          app.ownerId = undefined;
        }

        if (!app.ownerId) {
          this.logger.log(`Updated userId=${data.ownerId}`);
          app.ownerId = data.ownerId;
        } else {
          this.logger.warn(
            `Cannot set new owner on update, skipping field for appId=${app.appId}`,
          );
        }
      }
    }

    if (data.modules) {
      const newModulesMap = (data.modules || []).reduce(
        (o, m) => ({ ...o, [m.moduleId]: m }),
        {},
      );
      const oldModulesMap = (app.modules || []).reduce(
        (o, m) => ({ ...o, [m.moduleId]: m }),
        {},
      );

      let updatedModulesMap: Record<string, AppModuleConfigDto> = {};
      let removedModulesMap: Record<string, AppModuleConfigDto> = {};

      if (Object.keys(newModulesMap).length === 0) {
        removedModulesMap = oldModulesMap;
        updatedModulesMap = {};
      } else {
        Object.keys(newModulesMap).forEach((mid) => {
          if (oldModulesMap[mid]) {
            updatedModulesMap[mid] = newModulesMap[mid];
            delete newModulesMap[mid];
            delete oldModulesMap[mid];
          }
        });
        removedModulesMap = oldModulesMap;
      }

      const updatedModules = Object.values(updatedModulesMap);
      const removedModules = Object.values(removedModulesMap);

      if (updatedModules.length)
        this.logger.debug(
          `Updated modules: ${updatedModules.map((m) => m.moduleId)}`,
        );
      if (removedModules.length)
        this.logger.debug(
          `Removed modules: ${removedModules.map((m) => m.moduleId)}`,
        );

      if (updatedModules.length) {
        app.modules = [...updatedModules];

        data.clients = data.clients || [];
        // drop removed modules clients
        data.clients = data.clients.filter(
          (c) => removedModules.filter((m) => m.moduleId === c.clientId).length,
        );
        data.clients.push(
          ...updatedModules.map((m) => ({
            clientId: m.moduleId,
            secret: m.secret,
            name: m.name || m.moduleId,
            permissions: (m.supports || []).map((s) => `${s}.*`),
          })),
        );
      }

      if (removedModules.length) {
        app.clients = app.clients || [];
        app.clients = app.clients.filter((c) => !removedModulesMap[c.clientId]);

        if (!skipClients) {
          await Promise.all(
            removedModules.map((m) => {
              try {
                return this.keycloack.removeAppModuleClient(
                  app.appId,
                  m.moduleId,
                );
              } catch (e: any) {
                this.logger.warn(`Failed to remove  client: ${e.message}`);
                return Promise.resolve();
              }
            }),
          );
        }
      }
    }

    // add app client, used for users roles control
    data.clients = data.clients || [];

    // attempt to merge clients on update
    if (data.clients && data.clients.length) {
      if (!skipClients) {
        // for (const client of app.clients || []) {
        //   const found = data.clients.filter(
        //     (c) => c.clientId === client.clientId,
        //   );
        //   if (found) continue;

        //   this.logger.debug(
        //     `Removing clientId=${client.clientId} appId=${app.appId}`,
        //   );
        //   // todo
        // }

        // save all the clients
        for (const client of data.clients) {
          try {
            client.appId = app.appId;
            await this.keycloack.saveAppModuleClient(client);
            this.logger.debug(
              `Saved client=${client.clientId} for appId=${app.appId}`,
            );
          } catch (e) {
            this.logger.warn(
              `Failed to save ${app.appId} ${client.clientId}: ${e.stack}`,
            );
          }
        }
      }

      // update references
      app.clients = data.clients;
    }

    if (!skipClients) {
      // create app clients, providing  permission to users (role=owner) or platform admin (role=admin) to manage applications
      // const appClient =
      await this.keycloack.ensureAppClient(app.appId, app.name);
      await this.keycloack.setOwnerRole(app.appId, app.ownerId);
      await this.keycloack.addUserApps(app.ownerId, app.appId);
    }

    await app.save();

    return toDTO(app);
  }

  async searchApps(q: FilterQuery<PlatformApp>) {
    const apps = await this.platformApp.find(q).exec();
    return apps.map((app) => toDTO<PlatformAppDto>(app));
  }

  async listPublicApps() {
    const apps = await this.searchApps({
      public: true,
    });
    return apps.map(({ appId, description, name, tools, settings }) => ({
      appId,
      description,
      name,
      tools,
      settings,
    }));
  }

  async listUserApps(ownerId: string) {
    return await this.searchApps({
      ownerId,
    });
  }

  saveUser(user: RegistrationRequestDto) {
    return this.keycloack.saveUser(user);
  }

  getUser(username: string) {
    return this.keycloack.getUser(username);
  }

  removeUser(username: string) {
    return this.keycloack.removeUser(username);
  }

  setAdminRole(userId: string) {
    return this.keycloack.setAdminRole(userId);
  }

  setOwnerRole(appId: string, userId: string) {
    return this.keycloack.setOwnerRole(appId, userId);
  }

  getRepositoryDefaults() {
    return RepositoryDefaults;
  }
}
