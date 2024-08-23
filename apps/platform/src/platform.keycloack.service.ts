import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RegistrationRequestDto } from 'apps/auth/src/auth.dto';
import {
  EvaluatePermissionResourceDto,
  KeycloakClientResponseDto,
} from 'apps/keycloak/src/keycloack.authz.dto';
import {
  AssignClientRolesDto,
  AssignRealmRolesDto,
  KeycloakUser,
} from 'apps/keycloak/src/keycloak.admin.dto';
import {
  AddClientOptions,
  ClientLoginDto,
} from 'apps/keycloak/src/keycloak.dto';
import {
  KeycloakService,
  ROLE_ADMIN,
  ROLE_APP_OWNER,
} from 'apps/keycloak/src/keycloak.service';
import { getKeycloakClientId } from 'apps/keycloak/src/util';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import { fileExists, readJSON, toDTO } from 'libs/util';
import { PlatformAppAsyncApiService } from './app/platform.app.async.service';
import { AppClientDto } from './app/platform.app.dto';

export const APP_CLIENT_NAME = 'application';

@Injectable()
export class PlatformKeycloakService implements OnModuleInit {
  private readonly logger = new Logger(PlatformKeycloakService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly keycloack: KeycloakService,
    private readonly asyncApi: PlatformAppAsyncApiService,
  ) {}

  async onModuleInit() {
    await this.ensurePlatformClient(true);

    const filename = this.config.get('IMPORT_USERS_FILENAME');
    await this.importUsersFromFile(filename);
    await this.ensureAdminUser();
  }

  async ensureAdminUser() {
    const username = this.config.get('ADMIN_USER');
    const password = this.config.get('ADMIN_PASSWORD');

    if (!username || !password) return;

    let user = {
      username,
      password,
      firstName: 'admin',
      lastName: 'admin',
      enabled: true,
      email: 'admin@sermas.local',
      emailVerified: true,
      realmRoles: [ROLE_ADMIN],
      groups: [],
    };

    try {
      const roles: string[] = [];
      if (user.realmRoles) {
        roles.push(...user.realmRoles);
        delete user.realmRoles;
      }
      const raw = user as any;
      if (raw.roles) {
        roles.push(...raw.roles);
        delete raw.roles;
        user = raw;
      }

      this.logger.log(
        `Saving admin user ${user.username} roles=${roles} groups=${user.groups}`,
      );

      user.enabled = user.enabled === undefined ? true : user.enabled;
      if (user.email && user.emailVerified === undefined) {
        user.emailVerified = true;
      }

      const savedUser = await this.keycloack.saveUser(user);
      if (roles.length) {
        this.keycloack.assignRealmRoles({
          userId: savedUser.id,
          roles,
        });
      }
    } catch (e: any) {
      this.logger.error(`Failed to import user ${user.username}: ${e.stack}`);
    }
  }

  async importUsersFromFile(filename: string) {
    let importUsers: KeycloakUser[];
    try {
      if (!(await fileExists(filename))) return;
      importUsers = await readJSON(filename);
      if (importUsers === null) return;
    } catch (e: any) {
      this.logger.debug(`Failed to load ${filename}: ${e.message}`);
      return;
    }

    for (let user of importUsers) {
      try {
        const exists = await this.getUser(user.username);
        if (exists) continue;

        const roles: string[] = [];
        if (user.realmRoles) {
          roles.push(...user.realmRoles);
          delete user.realmRoles;
        }
        const raw = user as any;
        if (raw.roles) {
          roles.push(...raw.roles);
          delete raw.roles;
          user = raw;
        }

        this.logger.log(
          `Importing user ${user.username} roles=${roles} groups=${user.groups}`,
        );

        user.enabled = user.enabled === undefined ? true : user.enabled;
        if (user.email && user.emailVerified === undefined) {
          user.emailVerified = true;
        }

        const savedUser = await this.keycloack.saveUser(user);
        if (roles.length) {
          this.keycloack.assignRealmRoles({
            userId: savedUser.id,
            roles,
          });
        }
      } catch (e: any) {
        this.logger.error(`Failed to import user ${user.username}: ${e.stack}`);
      }
    }
  }

  async publishClient(
    client: AppClientDto,
    operation: SermasRecordChangedOperation,
  ) {
    this.asyncApi.clientChanged({
      record: toDTO(client),
      appId: client.appId,
      operation,
      clientId: null,
      ts: new Date(),
    });
  }

  async getAppClient(appId: string): Promise<KeycloakClientResponseDto | null> {
    const clientId = getKeycloakClientId(appId, APP_CLIENT_NAME);
    const client = await this.keycloack.getClientByName(clientId);
    return client || null;
  }

  async getAppModuleClient(
    appId: string,
    moduleId: string,
  ): Promise<KeycloakClientResponseDto | null> {
    const clientId = getKeycloakClientId(appId, moduleId);
    const client = await this.keycloack.getClientByName(clientId);
    return client || null;
  }

  async ensureAppClient(appId: string, description?: string) {
    const clientId = getKeycloakClientId(appId, APP_CLIENT_NAME);

    // const client = await this.getAppClient(appId);
    // if (client) {
    //   await this.removeAppModuleClient(appId, APP_CLIENT_NAME);
    // }

    const appClient = await this.keycloack.saveAppClient({
      clientId,
      clientRoles: [ROLE_APP_OWNER],
      realmRoles: [ROLE_ADMIN],
      permissions: ['auth.login', 'session.session'],
      attributes: ['appId'],
      description,
    });

    await this.setServiceAccountOwnerRole(appClient.clientId, appId);
    await this.addServiceAccountApp(appClient.clientId, appId);

    this.logger.log(`Created app client for appId=${appId}`);

    return appClient;
  }

  async addServiceAccountApp(clientId: string, appId: string) {
    const serviceAccount = await this.getUser(`service-account-${clientId}`);
    await this.addUserApps(serviceAccount.id, appId);
  }

  async getClientSecret(appId: string, clientId: string) {
    const client = await this.keycloack.getClientByName(
      getKeycloakClientId(appId, clientId),
    );
    if (!client)
      throw new NotFoundException(
        `Client ${clientId} not found for appId=${appId}`,
      );
    const credentials = await this.keycloack.getClientCredentials(client.id);
    return credentials?.value;
  }

  // async addAppModuleClient(client: AppClientDto, options?: AddClientOptions) {
  //   const clientId = getKeycloakClientId(client);

  //   options = options || {};
  //   if (options.upsert) {
  //     const kcClient = await this.keycloack.getClientByName(clientId);
  //     if (kcClient !== null) {
  //       client.secret = kcClient.secret;
  //       try {
  //         await this.keycloack.removeClient(clientId);
  //       } catch (e: any) {
  //         this.logger.warn(`Failed to remove clientId=${clientId}: ${e.stack}`);
  //       }
  //     }
  //   }

  //   const createdClient = await this.keycloack.saveClient({
  //     clientId,
  //     secret: client.secret,
  //     permissions: client.permissions,
  //     description: client.name,
  //     options: {
  //       ...(options || {}),
  //       allowScopeWildcard: true,
  //     },
  //   });

  //   await this.addServiceAccountApp(clientId, client.appId);

  //   this.publishClient(client, 'created');

  //   return createdClient;
  // }

  // async updateAppModuleClient(
  //   client: AppClientDto,
  //   options?: AddClientOptions,
  // ) {
  //   let secret = client.secret;
  //   if (!secret) {
  //     secret = await this.getClientSecret(client.appId, client.clientId);
  //   }
  //   await this.removeAppModuleClient(client.appId, client.clientId);
  //   await this.keycloack.saveClient({
  //     clientId: getKeycloakClientId(client),
  //     permissions: client.permissions,
  //     secret,
  //     description: client.name,
  //     options: {
  //       ...(options || {}),
  //       allowScopeWildcard: true,
  //     },
  //   });
  //   this.publishClient(client, 'updated');
  // }

  async saveAppModuleClient(data: AppClientDto, options?: AddClientOptions) {
    if (!data.appId) throw new BadRequestException('Missing appId');
    if (!data.clientId) throw new BadRequestException('Missing clientId');

    const exists = await this.getAppModuleClient(data.appId, data.clientId);

    let secret = data.secret;
    if (!secret && exists) {
      secret = await this.getClientSecret(data.appId, data.clientId);
    }

    const keycloakClientId = getKeycloakClientId(data.appId, data.clientId);
    await this.keycloack.saveClient({
      clientId: keycloakClientId,
      permissions: data.permissions,
      secret,
      description: data.name,
      options: {
        ...(options || {}),
        allowScopeWildcard: true,
      },
    });

    await this.addServiceAccountApp(keycloakClientId, data.appId);

    const client = { ...data, secret };
    this.publishClient(client, exists ? 'updated' : 'created');

    return client;
  }

  async removeAppModuleClient(appId: string, clientId: string) {
    const client: AppClientDto = { appId, clientId, permissions: [] };
    try {
      await this.keycloack.removeClient(getKeycloakClientId(client));
      this.publishClient(client, 'updated');
    } catch (e: any) {
      this.logger.warn(
        `Failed to remove client appId=${appId} clientId=${clientId}: ${e.message}`,
      );
    }
  }

  removeUser(username: string) {
    return this.keycloack.removeUser(username);
  }

  getUsers(username: string, exact = false) {
    return this.keycloack.getUsers(username, exact);
  }

  async getUser(username: string) {
    const users = await this.getUsers(username, true);
    return users.length ? users[0] : null;
  }

  async getUserById(userId: string) {
    try {
      return await this.keycloack.getUserById(userId);
    } catch (e) {
      this.logger.warn(`Failed to load ${userId}`);
      return null;
    }
  }

  async saveUser(payload: RegistrationRequestDto) {
    const data: KeycloakUser = {
      email: payload.email,
      username: payload.username,
      password: payload.password || undefined,
      emailVerified: true,
      groups: [],
      enabled: true,
      firstName: payload.firstName || ' ',
      lastName: payload.lastName || ' ',
    };

    await this.keycloack.saveUser(data);

    return await this.keycloack.getUserByUsername(data.username);
  }

  async setClientRoles(appId: string, userId: string, roles: string[]) {
    const client = await this.getAppClient(appId);

    const data: AssignClientRolesDto = {
      client,
      userId,
      roles,
    };
    this.logger.log(
      `Assigning roles ${data.roles} to userId=${userId} appId=${appId}`,
    );
    return this.keycloack.assignClientRoles(data);
  }

  async setRealmRoles(userId: string, roles: string[]) {
    const data: AssignRealmRolesDto = {
      userId,
      roles,
    };
    this.logger.log(`Assigning realm roles ${data.roles} to userId=${userId}`);
    return this.keycloack.assignRealmRoles(data);
  }

  setAdminRole(userId: string) {
    return this.setRealmRoles(userId, [ROLE_ADMIN]);
  }

  setOwnerRole(appId: string, userId: string) {
    return this.setClientRoles(appId, userId, [ROLE_APP_OWNER]);
  }

  async setServiceAccountOwnerRole(clientId: string, appId: string) {
    const serviceAccount = await this.getUser(`service-account-${clientId}`);
    if (!serviceAccount)
      throw new NotFoundException(`service account for ${clientId} not found`);
    return this.setClientRoles(appId, serviceAccount.id, [ROLE_APP_OWNER]);
  }

  addUserApps(userId: string, appId: string | string[]) {
    return this.keycloack.assignUserApps(userId, appId, true);
  }

  async removeUserApps(userId: string, appId: string | string[]) {
    appId = appId instanceof Array ? appId : [appId];

    let apps: string[];
    try {
      apps = await this.getUserApps(userId);
    } catch (e) {
      this.logger.warn(`Failed to get user ${userId}: ${e.message}`);
      return [];
    }

    apps = apps.filter((appId1) => !appId.includes(appId1));

    return this.keycloack.assignUserApps(userId, apps, false);
  }

  getUserApps(userId: string) {
    return this.keycloack.getUserApps(userId);
  }

  async ensurePlatformClient(force = false) {
    await this.keycloack.ensureRealm(this.keycloack.getRealm());

    const client = await this.keycloack.savePlatformClient({
      clientId: this.keycloack.getPlatformClientName(),
      adminRole: ROLE_ADMIN,
      secret: this.config.get('AUTH_KEYCLOAK_SECRET'),
      removeIfExists: force,
      attributes: ['appId'],
    });

    return await this.keycloack.getClientByName(client.clientId);
  }

  login(username: string, password: string, clientId?: string) {
    return this.keycloack.login(username, password, clientId).catch(() => {
      this.logger.log(`Login failed username=${username} clientId=${clientId}`);
      return null;
    });
  }

  refreshToken(accessToken: string, refreshToken: string, clientId: string) {
    return this.keycloack
      .getClientRefreshToken({
        accessToken,
        refreshToken,
        clientId,
      })
      .catch((e) => {
        this.logger.warn(`Failed to refresh token for ${clientId}: ${e.stack}`);
        return null;
      });
  }

  async getClientAccessToken(data: ClientLoginDto) {
    return this.keycloack.getClientAccessToken(data);
  }

  async getAppClientAccessToken(appId: string, appClientId: string) {
    const client = await this.keycloack.getClientByName(
      getKeycloakClientId(appId, appClientId),
    );
    return this.getClientAccessToken({
      clientId: client.clientId,
      clientSecret: client.secret,
    });
  }

  async getAllowedResources(clientId: string, userId: string) {
    const client = await this.keycloack.getClientByName(clientId);
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);

    const resources = await this.keycloack.listResources(client.id);

    return await this.keycloack.evaluatePermission(clientId, {
      context: {},
      entitlements: true,
      resources: resources as EvaluatePermissionResourceDto[],
      roleIds: [],
      userId,
    });
  }
}
