import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SermasBaseModule } from 'apps/api/src/sermas.base.module';
import { APP_CLIENT_NAME } from 'apps/platform/src/platform.keycloack.service';
import { PlatformModule } from 'apps/platform/src/platform.module';
import { PlatformTopicsService } from 'apps/platform/src/topics/platform.topics.service';
import { uuidv4 } from 'libs/util';
import { KEYCLOACK_TEST_REALM } from 'libs/test';
import { KeycloakUser } from './keycloak.admin.dto';
import { KeycloakModule } from './keycloak.module';
import {
  KeycloakService,
  ROLE_ADMIN,
  ROLE_APP_OWNER,
} from './keycloak.service';
import { getKeycloakClientId } from './util';

jest.setTimeout(5 * 60 * 1000);

const realm = KEYCLOACK_TEST_REALM;

const newUser = (username?: string, realmRoles?: string[]): KeycloakUser => {
  username = username || `test-user-${uuidv4()}`;
  realmRoles = realmRoles || [];
  return {
    username,
    email: `${username}@services.test`,
    emailVerified: true,
    enabled: true,
    realmRoles,
  };
};

describe('KeycloackService', () => {
  let moduleRef: TestingModule;

  let keycloakService: KeycloakService;
  let topicsService: PlatformTopicsService;

  beforeEach(() => {
    if (keycloakService) keycloakService.setRealm(realm);
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [SermasBaseModule, PlatformModule, KeycloakModule],
      controllers: [],
      providers: [],
    }).compile();

    moduleRef.useLogger(new Logger());

    topicsService = moduleRef.get(PlatformTopicsService);

    keycloakService = moduleRef.get(KeycloakService);
    keycloakService.setRealm(realm);

    await moduleRef.init();

    await keycloakService.removeClientByName('test-');
    await keycloakService.removeUserByName('test-');
    await keycloakService.deleteRealmByName('test-realm-');
    await keycloakService.deleteGroupByName('test-app-');
  });
  afterAll(async () => {
    // await keycloakService.removeClientByName('test-');
    if (moduleRef) await moduleRef.close();
  });

  describe('keycloak', () => {
    it('should handle wildcards in permission generation', async () => {
      let permissions = keycloakService.extractResources(['dialogue.*'], {
        allowScopeWildcard: true,
      });
      const topicTree = topicsService.toTree();
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions[0].scopes.length).toBe(topicTree['dialogue'].length);
      expect(
        permissions.filter((p) => p.scopes.includes('*')).length,
      ).toBeFalsy();

      permissions = keycloakService.extractResources(['*'], {
        allowWildcard: true,
      });
      expect(permissions.length).toBe(Object.keys(topicTree).length);
    });

    it('should create platform clients', async () => {
      const clientId = `test-platform-${uuidv4()}`;
      const clientSecret = `test-secret-${uuidv4()}`;
      const client = await keycloakService.savePlatformClient({
        clientId,
        secret: clientSecret,
      });

      const credentials = await keycloakService.getClientCredentials(client.id);
      expect(credentials).toBeTruthy();
      expect(credentials.value).not.toBeFalsy();
      expect(credentials.value).toBe(clientSecret);

      const user1 = await keycloakService.saveUser(
        newUser(`test-user-${uuidv4()}`),
      );
      const admin1 = await keycloakService.saveUser(
        newUser(`test-admin-${uuidv4()}`),
      );

      await keycloakService.assignRealmRoles({
        userId: admin1.id,
        roles: [ROLE_ADMIN],
      });

      let res = await keycloakService.evaluatePermission(client.clientId, {
        roleIds: [],
        context: {},
        entitlements: false,
        resources: [
          {
            name: 'platform',
            scopes: [
              {
                name: 'platform:token',
              },
            ],
          },
        ],
        userId: user1.id,
      });

      expect(res.status).toBe('DENY');

      res = await keycloakService.evaluatePermission(client.clientId, {
        roleIds: [],
        context: {},
        entitlements: false,
        resources: [
          {
            name: 'platform',
            scopes: [
              {
                name: 'platform:token',
              },
            ],
          },
        ],
        userId: admin1.id,
      });

      expect(res.status).toBe('PERMIT');
    });

    it('should create app client and assign to a user', async () => {
      const appId = getKeycloakClientId(
        `test-app-${uuidv4()}`,
        APP_CLIENT_NAME,
      );
      const appClient = await keycloakService.saveAppClient({
        clientId: appId,
        clientRoles: ['owner'],
        realmRoles: ['admin'],
        permissions: ['auth.login'],
        attributes: ['appId'],
      });
      expect(appClient).not.toBeFalsy();

      const user = await keycloakService.saveUser(newUser());
      // set user as app owner
      await keycloakService.assignClientRoles({
        client: appClient,
        roles: [ROLE_APP_OWNER],
        userId: user.id,
      });

      const attributes1 = await keycloakService.assignUserApps(user.id, appId);
      expect(attributes1.length).toBe(1);

      const attributes2 = await keycloakService.assignUserApps(
        user.id,
        'test-appid-2',
      );
      expect(attributes2.length).toBe(2);
      expect(attributes2.filter((appId1) => appId1 === appId).length).toBe(1);
    });

    it('should create modules client', async () => {
      const client = await keycloakService.saveClient({
        options: {
          allowScopeWildcard: true,
          allowWildcard: true,
        },
        clientId: `test-module-${uuidv4()}`,
        permissions: ['*'],
      });

      const credentials = await keycloakService.getClientCredentials(client.id);

      const audience = client.clientId;
      const token = await keycloakService.getClientAccessToken({
        clientId: client.clientId,
        clientSecret: credentials.value,
        realm,
        audience,
      });

      expect(token).not.toBeFalsy();
      expect(token.access_token).not.toBeFalsy();

      const tokenData = keycloakService.parseJWT(token.access_token);

      expect(token.access_token).not.toBeFalsy();

      expect(tokenData.azp).toBe(audience);
    });

    it('should delete and create realm roles', async () => {
      await keycloakService.createRealmRole('test-foobar');
      await keycloakService.createRealmRole('test-foobar');
      await keycloakService.deleteRealmRole('test-foobar');
      await keycloakService.deleteRealmRole('not-existing-one');
    });

    it('should manage realms', async () => {
      const realmName = `test-realm-${uuidv4()}`;
      const realm = await keycloakService.createRealm(realmName);
      expect(realm).not.toBeFalsy();
      expect(realm.realm).toBe(realmName);

      const realms = await keycloakService.listRealms(realmName);
      expect(realms.filter((r) => r.realm === realmName).length).toBe(1);

      await keycloakService.deleteRealm(realmName);
    });

    it('should setup a new platform instance', async () => {
      const realmName = `test-realm-${uuidv4()}`;
      const realm = await keycloakService.createRealm(realmName);
      expect(realm).not.toBeFalsy();
      expect(realm.realm).toBe(realmName);

      keycloakService.setRealm(realmName);

      const clientId = keycloakService.getPlatformClientName();
      const clientSecret = `test-secret-${uuidv4()}`;
      const client = await keycloakService.savePlatformClient({
        clientId,
        secret: clientSecret,
      });

      const userData = newUser(`test-user-${uuidv4()}`);
      userData.password = 'test-password';
      await keycloakService.saveUser(userData);

      const token = await keycloakService.login(
        userData.username,
        userData.password,
        client.clientId,
      );
      const jwtData = keycloakService.parseJWT(token.access_token);

      expect(jwtData).not.toBeFalsy();
      expect(jwtData.azp).toBe(client.clientId);
    });
  });
});
