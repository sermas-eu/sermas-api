import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SermasBaseModule } from 'apps/api/src/sermas.base.module';
import { uuidv4 } from 'libs/dataset/src';
import { KEYCLOACK_TEST_REALM } from 'libs/test';
import { KeycloakAdminService } from './keycloak.admin.service';
import { KeycloakModule } from './keycloak.module';

jest.setTimeout(10 * 1000);

const realm = KEYCLOACK_TEST_REALM;

describe('KeycloackAdminService', () => {
  let moduleRef: TestingModule;

  let keycloakService: KeycloakAdminService;
  let username: string;
  let userId: string;
  let users: any[];

  const getToken = async (): Promise<string> => {
    const token = await keycloakService.getKeycloakAdminToken({
      username: process.env.ADMIN_SERVICE_ACCOUNT_USERNAME,
      password: process.env.ADMIN_SERVICE_ACCOUNT_PASSWORD,
    });
    expect(token).not.toBeFalsy();
    return token;
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [SermasBaseModule, KeycloakModule],
      controllers: [],
      providers: [],
    }).compile();

    moduleRef.useLogger(new Logger());

    keycloakService = moduleRef.get(KeycloakAdminService);

    let token = await getToken();

    try {
      await keycloakService.createRealm({
        token,
        realm,
      });
    } catch {}

    const clients = await keycloakService.clientsList({
      realm,
      token,
    });

    username = 'test-user-' + uuidv4();
    await keycloakService.saveUser(token, realm, {
      username,
      email: username + '@test.local',
      realmRoles: [],
      emailVerified: true,
      credentials: undefined,
      enabled: true,
      groups: [],
    });

    users = (await keycloakService.usersList({ realm, token })).filter(
      (u) => u.username.indexOf('test-user') > -1,
    );
    userId = users.filter((u) => u.username === username)[0].id;
    expect(userId).toBeTruthy();

    token = await getToken();
    await Promise.all(
      clients
        .filter((client) => client.clientId.indexOf('sermas-test') > -1)
        .map((c) =>
          keycloakService.deleteClient({
            name: c.id,
            token,
            realm,
          }),
        ),
    );

    await moduleRef.init();
  });
  afterAll(async () => {
    const token = await getToken();
    await Promise.all(
      (users || []).map((u) =>
        keycloakService.deleteUserById(token, realm, u.id),
      ),
    );

    if (moduleRef) await moduleRef.close();
  });

  describe('keycloack integration', () => {
    it('should create a client with resource and scopes from topics', async () => {
      let token = await getToken();
      expect(token).not.toBeFalsy();

      const res = await keycloakService.createClient({
        token,
        realm,
        name: 'sermas-test-' + uuidv4(),
      });

      token = await getToken();
      expect(token).not.toBeFalsy();

      await keycloakService.createClientPermissions({
        ...res,
        realm,
        token,
        resources: [
          {
            name: 'dialogue',
            scopes: ['messages'],
          },
        ],
      });

      const evaluatePermission = async (
        resource: string,
        scope: string,
        expectedValue: 'PERMIT' | 'DENY',
      ) => {
        token = await getToken();
        const evalResponse = await keycloakService.evaluatePermission({
          token,
          realm,
          clientId: res.id,
          payload: {
            userId,
            roleIds: [],
            context: {},
            entitlements: false,
            resources: [
              {
                name: resource,
                scopes: [{ name: scope }],
              },
            ],
          },
        });
        expect(evalResponse).toBeTruthy();
        expect(evalResponse.results.length === 1).toBeTruthy();
        expect(evalResponse.results[0].status).toBe(expectedValue);
      };

      await evaluatePermission('dialogue', 'messages', 'PERMIT');
      await evaluatePermission('detection', 'noise', 'DENY');
    });
  });
});
