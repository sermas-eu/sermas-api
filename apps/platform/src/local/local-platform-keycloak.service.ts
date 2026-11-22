import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RegistrationRequestDto } from '#apps/auth/src/auth.dto';
import { KeycloakService } from '#apps/keycloak/src/keycloak.service';
import { LocalKeycloakService } from '#apps/keycloak/src/local/local-keycloak.service';
import { getKeycloakClientId } from '#apps/keycloak/src/util';
import { PlatformAppAsyncApiService } from '../app/platform.app.async.service.js';
import {
  APP_CLIENT_NAME,
  PlatformKeycloakService,
} from '../platform.keycloack.service.js';

/**
 * AUTH_PROVIDER=local: the platform's Keycloak operations without a Keycloak.
 * Clients, tokens and the scope check go to LocalKeycloakService; realm setup,
 * roles and app/user bindings are no-ops; creating or changing users is refused.
 * Every app is owned by the one admin (or the import user standing in for it).
 */
export class LocalPlatformKeycloakService extends PlatformKeycloakService {
  private readonly localLogger = new Logger('LocalPlatformAuth');

  constructor(
    private readonly localConfig: ConfigService,
    private readonly local: LocalKeycloakService,
    asyncApi: PlatformAppAsyncApiService,
  ) {
    super(localConfig, local as unknown as KeycloakService, asyncApi);
  }

  async onModuleInit() {
    this.localLogger.log('Local auth: no Keycloak, no user management');
  }

  async waitForKeycloak() {}
  async ensurePlatformClient() {
    return null;
  }
  async ensureKioskClient() {}
  async ensureAdminUser() {}
  async importUsersFromFile() {}

  /** every app has its `application` login client, nothing to create */
  async ensureAppClient(appId: string) {
    return this.local.getClientByName(
      getKeycloakClientId(appId, APP_CLIENT_NAME),
    );
  }

  async addServiceAccountApp() {}
  async setServiceAccountOwnerRole() {}
  async setClientRoles() {}
  async setRealmRoles() {}
  async setAdminRole() {}
  async setOwnerRole() {}
  async addUserApps(): Promise<string[]> {
    return [];
  }
  async removeUserApps() {
    return [];
  }
  async getUserApps() {
    return [];
  }

  private adminRecord() {
    return {
      id: this.local.getAdminSubject(),
      username: this.local.getAdminUser()?.username || 'admin',
      enabled: true,
    } as any;
  }

  async getUsers(username: string) {
    const admin = this.local.getAdminUser();
    // the import user (app import) stands for the admin
    if (
      (admin && username === admin.username) ||
      username === this.localConfig.get('IMPORT_USER')
    ) {
      return [this.adminRecord()];
    }
    return [];
  }

  async getUser(username: string) {
    return (await this.getUsers(username))[0] || null;
  }

  async getUserById(userId: string) {
    return userId === this.local.getAdminSubject() ? this.adminRecord() : null;
  }

  async saveUser(_payload: RegistrationRequestDto): Promise<any> {
    this.local.notAvailable();
  }

  async removeUser(_username: string): Promise<any> {
    this.local.notAvailable();
  }

  async getAllowedResources(clientId: string, userId: string) {
    return (await this.local.allowedResources(clientId, userId)) as any;
  }
}
