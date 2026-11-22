import { JwtVerifierService } from '#libs/auth/jwt.verifier.service';
import { getLocalJwks } from '#libs/auth/local/local-auth';
import { LocalOidcController } from '#apps/auth/src/oidc/local-oidc.controller';
import { ROLE_ADMIN } from '../keycloak.service.js';
import {
  LocalKeycloakService,
  matchPermissions,
} from './local-keycloak.service.js';

const env = (over: Record<string, string> = {}) => {
  const values: Record<string, string> = {
    AUTH_PROVIDER: 'local',
    AUTH_KEYCLOAK_REALM: 'sermas-local',
    AUTH_KEYCLOAK_URL: 'http://api:8080/api/auth/oidc',
    AUTH_KEYCLOAK_FRONTEND_URL: 'https://demo.example.org/api/auth/oidc',
    AUTH_KEYCLOAK_CLIENT_ID: 'platform',
    AUTH_KEYCLOAK_SECRET: 'platform-secret',
    AUTH_KEYCLOAK_KIOSK_CLIENT_ID: 'kiosk',
    AUTH_KEYCLOAK_KIOSK_CLIENT_SECRET: 'kiosk-secret',
    ADMIN_USER: 'admin',
    ADMIN_PASSWORD: 'a-strong-one',
    IMPORT_USER: 'import',
    ...over,
  };
  return { get: (k: string) => values[k] } as any;
};

// one app with an avatar client, as MongoDB holds it
const connection = {
  collection: () => ({
    find: (q: any) => ({
      toArray: async () =>
        q.appId.$in.includes('demo-app')
          ? [
              {
                appId: 'demo-app',
                clients: [
                  {
                    clientId: 'avatar',
                    permissions: [
                      'session.*',
                      'dialogue.messages',
                      'platform.app',
                    ],
                  },
                ],
              },
            ]
          : [],
    }),
  }),
} as any;

const topics = {
  toJSON: () => [
    { resource: 'session', scope: 'session' },
    { resource: 'dialogue', scope: 'messages' },
    { resource: 'dialogue', scope: 'speech' },
    { resource: 'platform', scope: 'app' },
  ],
};

describe('LocalKeycloakService (AUTH_PROVIDER=local)', () => {
  const make = (over?: Record<string, string>) =>
    new LocalKeycloakService(env(over), connection, topics);

  it('issues tokens the API verifier accepts, with the public issuer', async () => {
    const local = make();
    const res = await local.getClientAccessToken({
      clientId: 'kiosk',
      clientSecret: 'kiosk-secret',
    });
    const verifier = new JwtVerifierService(env());
    const claims: any = await verifier.verify(res.access_token);
    expect(claims.iss).toBe(
      'https://demo.example.org/api/auth/oidc/realms/sermas-local',
    );
    expect(claims.azp).toBe('kiosk');
    expect(claims.preferred_username).toBe('service-account-kiosk');
    expect(claims.realm_access.roles).toEqual([]);
    expect(getLocalJwks().keys[0]).toMatchObject({
      kty: 'RSA',
      alg: 'RS256',
      use: 'sig',
    });
  });

  it('refuses a wrong client secret, and an unknown client', async () => {
    const local = make();
    await expect(
      local.getClientAccessToken({ clientId: 'kiosk', clientSecret: 'nope' }),
    ).rejects.toThrow(/401/);
    await expect(
      local.getClientAccessToken({ clientId: 'ghost', clientSecret: 'x' }),
    ).rejects.toThrow(/401/);
  });

  it('logs the admin in, as platform-admin', async () => {
    const local = make();
    const res = await local.login('admin', 'a-strong-one');
    const claims: any = await new JwtVerifierService(env()).verify(
      res.access_token,
    );
    expect(claims.sub).toBe(local.getAdminSubject());
    expect(claims.realm_access.roles).toEqual([ROLE_ADMIN]);
    expect(claims.azp).toBe('platform');
  });

  it('has no admin login with a default or missing password', async () => {
    for (const ADMIN_PASSWORD of ['admin', '']) {
      const local = make({ ADMIN_PASSWORD });
      await expect(local.login('admin', ADMIN_PASSWORD)).rejects.toThrow();
      expect(local.getAdminUser()).toBeNull();
    }
  });

  it('locks a username after repeated failures', async () => {
    const local = make();
    for (let i = 0; i < 5; i++)
      await expect(local.login('admin', 'bad')).rejects.toThrow();
    await expect(local.login('admin', 'a-strong-one')).rejects.toThrow(
      /too many/,
    );
  });

  it('rotates refresh tokens: each is used once', async () => {
    const local = make();
    const first = await local.login('admin', 'a-strong-one');
    const second = await local.getClientRefreshToken({
      clientId: 'platform',
      refreshToken: first.refresh_token,
    });
    expect(second.access_token).toBeTruthy();
    await expect(
      local.getClientRefreshToken({
        clientId: 'platform',
        refreshToken: first.refresh_token,
      }),
    ).rejects.toThrow(/401/);
    await expect(
      local.getClientRefreshToken({
        clientId: 'kiosk',
        refreshToken: second.refresh_token,
      }),
    ).rejects.toThrow(/401/);
  });

  it("loads an app's clients from its record and grants their permissions", async () => {
    const local = make();
    const client = await local.getClientByName('demo-app-avatar');
    expect(client.clientId).toBe('demo-app-avatar');
    const token = await local.getClientAccessToken({
      clientId: 'demo-app-avatar',
      clientSecret: client.secret,
    });
    const claims: any = await new JwtVerifierService(env()).verify(
      token.access_token,
    );
    expect(claims.appId).toEqual(['demo-app']);

    const allowed = (
      resource: string,
      scopes: string[],
      clientId = 'demo-app-avatar',
    ) => local.isAllowed({ clientId, appId: 'demo-app', resource, scopes });
    expect(await allowed('session', ['session'])).toBe(true);
    expect(await allowed('dialogue', ['messages'])).toBe(true);
    expect(await allowed('dialogue', ['speech'])).toBe(false);
    expect(await allowed('platform', ['app:editor'])).toBe(true);
    // short client name resolved through the app
    expect(await allowed('session', ['session'], 'avatar')).toBe(true);
    expect(await local.getClientByName('other-app-avatar')).toBeNull();
  });

  it('the kiosk client holds no scope; the platform client only for admin and itself', async () => {
    const local = make();
    expect(
      await local.isAllowed({
        clientId: 'kiosk',
        resource: 'session',
        scopes: ['session'],
      }),
    ).toBe(false);
    const p = (userId: string) =>
      local.isAllowed({
        clientId: 'platform',
        userId,
        resource: 'platform',
        scopes: ['app'],
      });
    expect(await p(local.getAdminSubject())).toBe(true);
    expect(await p('service-account-platform')).toBe(true);
    expect(await p('someone')).toBe(false);
  });

  it('lists allowed resources in the entitlement shape', async () => {
    const local = make();
    const res = await local.allowedResources('demo-app-avatar', 'x');
    expect(res.results[0].allowedScopes.map((s) => s.name)).toEqual([
      'session:session',
      'dialogue:messages',
      'platform:app',
    ]);
  });
});

describe('matchPermissions', () => {
  it('wildcards, resource wildcards and fine-grained scopes', () => {
    expect(matchPermissions(['*'], 'x', ['y'])).toBe(true);
    expect(matchPermissions(['x.*'], 'x', ['y'])).toBe(true);
    expect(matchPermissions(['x.y'], 'x', ['y:edit'])).toBe(true);
    expect(matchPermissions(['x.y'], 'x', ['z'])).toBe(false);
    expect(matchPermissions(['x.y'], 'x', [])).toBe(false);
    expect(matchPermissions(['x.y'], '', ['y'])).toBe(false);
  });
});

describe('LocalOidcController', () => {
  const controller = new LocalOidcController(
    new LocalKeycloakService(env(), connection, topics) as any,
  );

  it('client_credentials, as the node SDK posts it', async () => {
    const res: any = await controller.token('sermas-local', {
      grant_type: 'client_credentials',
      client_id: 'kiosk',
      client_secret: 'kiosk-secret',
    });
    expect(res.token_type).toBe('Bearer');
  });

  it('client_credentials with HTTP Basic', async () => {
    const basic =
      'Basic ' + Buffer.from('kiosk:kiosk-secret').toString('base64');
    const res: any = await controller.token(
      'sermas-local',
      { grant_type: 'client_credentials' },
      basic,
    );
    expect(res.access_token).toBeTruthy();
  });

  it('OAuth errors: bad secret 401, wrong grant 400, other realm 404', async () => {
    const status = (p: Promise<unknown>) =>
      p.then(
        () => 200,
        (e) => e.getStatus(),
      );
    expect(
      await status(
        controller.token('sermas-local', {
          grant_type: 'client_credentials',
          client_id: 'kiosk',
          client_secret: 'x',
        }),
      ),
    ).toBe(401);
    expect(
      await status(
        controller.token('sermas-local', {
          grant_type: 'implicit',
          client_id: 'kiosk',
        }),
      ),
    ).toBe(400);
    expect(
      await status(
        controller.token('other', {
          grant_type: 'client_credentials',
          client_id: 'kiosk',
        }),
      ),
    ).toBe(404);
  });

  it('password grant only through the platform client or an app login client', async () => {
    const status = (p: Promise<unknown>) =>
      p.then(
        () => 200,
        (e) => e.getStatus(),
      );
    const pw = {
      grant_type: 'password',
      username: 'admin',
      password: 'a-strong-one',
    };
    expect(
      await status(
        controller.token('sermas-local', { ...pw, client_id: 'platform' }),
      ),
    ).toBe(200);
    expect(
      await status(
        controller.token('sermas-local', {
          ...pw,
          client_id: 'platform',
          password: 'x',
        }),
      ),
    ).toBe(401);
    expect(
      await status(
        controller.token('sermas-local', {
          ...pw,
          client_id: 'kiosk',
          client_secret: 'kiosk-secret',
        }),
      ),
    ).toBe(400);
    expect(
      await status(
        controller.token('sermas-local', {
          ...pw,
          client_id: 'demo-app-application',
        }),
      ),
    ).toBe(200);
  });

  it('never issues platform client tokens, even with its secret', async () => {
    const status = (p: Promise<unknown>) =>
      p.then(
        () => 200,
        (e) => e.getStatus(),
      );
    expect(
      await status(
        controller.token('sermas-local', {
          grant_type: 'client_credentials',
          client_id: 'platform',
          client_secret: 'platform-secret',
        }),
      ),
    ).toBe(400);
  });

  it('answers 404 when Keycloak is in use', () => {
    const kc = new LocalOidcController({} as any);
    expect(() => kc.certs('sermas-local')).toThrow();
  });
});
