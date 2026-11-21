import { ConfigService } from '@nestjs/config';
import type { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { PlatformContextDto } from './platform.auth.dto.js';
import { PlatformAuthService } from './platform.auth.service.js';

const appsModel = (apps: Record<string, string[]>) => ({
  findOne: vi.fn(({ appId }: { appId: string }) => ({
    lean: async () =>
      apps[appId]
        ? { clients: apps[appId].map((clientId) => ({ clientId })) }
        : null,
  })),
});

const createService = (
  permit: (clientId: string, userId: string) => boolean,
  apps: Record<string, string[]> = {},
) => {
  const keycloak = {
    getClientByName: vi.fn(async (name: string) => ({ id: `id-${name}` })),
    getClientScopes: vi.fn(async () => [{ name: 'session:read' }]),
    evaluatePermission: vi.fn(async (clientId: string, data: any) => ({
      status: permit(clientId, data.userId) ? 'PERMIT' : 'DENY',
    })),
  };
  const config = {
    get: (key: string) =>
      key === 'AUTH_KEYCLOAK_SYSTEM_CLIENT_ID' ? 'system' : 'platform',
  };
  return {
    service: new PlatformAuthService(
      config as any,
      keycloak as any,
      appsModel(apps) as any,
    ),
    keycloak,
  };
};

const ctx = (clientId: string, userId: string): PlatformContextDto => ({
  token: 'token',
  appId: 'app1',
  clientId,
  userId,
  resource: 'session',
  scopes: ['read'],
});

describe('PlatformAuthService.isAllowed', () => {
  afterEach(() => vi.useRealTimers());

  it('does not share a cached answer between users of an app', async () => {
    const { service } = createService((_c, userId) => userId === 'alice');
    expect(await service.isAllowed(ctx('app1-kiosk', 'alice'))).toBe(true);
    expect(await service.isAllowed(ctx('app1-kiosk', 'bob'))).toBe(false);
  });

  it('does not share a cached answer between clients of an app', async () => {
    const { service } = createService((clientId) => clientId === 'app1-a');
    expect(await service.isAllowed(ctx('app1-a', 'u'))).toBe(true);
    expect(await service.isAllowed(ctx('app1-b', 'u'))).toBe(false);
  });

  it('answers a repeated request from the cache, without Keycloak', async () => {
    const { service, keycloak } = createService(() => true);
    await service.isAllowed(ctx('app1-a', 'u'));
    await service.isAllowed(ctx('app1-a', 'u'));
    expect(keycloak.getClientByName).toHaveBeenCalledTimes(1);
    expect(keycloak.getClientScopes).toHaveBeenCalledTimes(1);
    expect(keycloak.evaluatePermission).toHaveBeenCalledTimes(1);
  });

  it('asks again once the cached answer expires', async () => {
    vi.useFakeTimers();
    const { service, keycloak } = createService(() => true);
    await service.isAllowed(ctx('app1-a', 'u'));
    vi.advanceTimersByTime(31_000);
    await service.isAllowed(ctx('app1-a', 'u'));
    expect(keycloak.evaluatePermission).toHaveBeenCalledTimes(2);
  });

  it('denies, without caching, when Keycloak fails', async () => {
    const { service, keycloak } = createService(() => true);
    keycloak.evaluatePermission.mockRejectedValueOnce(new Error('down'));
    expect(await service.isAllowed(ctx('app1-a', 'u'))).toBe(false);
    expect(await service.isAllowed(ctx('app1-a', 'u'))).toBe(true);
  });

  it('denies a client without the requested scope', async () => {
    const { service, keycloak } = createService(() => true);
    keycloak.getClientScopes.mockResolvedValueOnce([{ name: 'other:read' }]);
    expect(await service.isAllowed(ctx('app1-a', 'u'))).toBe(false);
    expect(keycloak.evaluatePermission).not.toHaveBeenCalled();
  });
});

describe('PlatformAuthService.isOwnAppClient', () => {
  const apps = { myapp: ['avatar', 'application'], 'myapp-x': ['avatar'] };

  it("accepts the app's own clients", async () => {
    const { service } = createService(() => false, apps);
    expect(await service.isOwnAppClient('myapp', 'myapp-avatar')).toBe(true);
    expect(await service.isOwnAppClient('myapp', 'myapp-application')).toBe(
      true,
    );
  });

  it('rejects clients of another app, even with a matching prefix', async () => {
    const { service } = createService(() => false, apps);
    expect(await service.isOwnAppClient('myapp', 'myapp-x-avatar')).toBe(false);
    expect(await service.isOwnAppClient('myapp', 'other-avatar')).toBe(false);
    expect(await service.isOwnAppClient('myapp', 'platform')).toBe(false);
  });

  it('rejects everything for an unknown app', async () => {
    const { service } = createService(() => false, apps);
    expect(await service.isOwnAppClient('nope', 'nope-avatar')).toBe(false);
  });
});

const systemService = (env: Record<string, string> = {}) =>
  new PlatformAuthService(
    new ConfigService({
      AUTH_KEYCLOAK_CLIENT_ID: 'platform',
      AUTH_KEYCLOAK_SYSTEM_CLIENT_ID: '',
      AUTH_KEYCLOAK_KIOSK_CLIENT_ID: 'kiosk',
      AUTH_KEYCLOAK_KIOSK_CLIENT_SECRET: 'secret',
      AUTH_KEYCLOAK_KIOSK_APP_CLIENTS: 'avatar,robot',
      ...env,
    }),
    {} as any,
    {} as any,
  );

const jwt = (azp: string, username: string) =>
  ({ azp, preferred_username: username }) as AuthJwtUser;

describe('PlatformAuthService system clients', () => {
  describe('isSystemClient', () => {
    it("accepts the platform client's service account", () => {
      expect(
        systemService().isSystemClient(
          jwt('platform', 'service-account-platform'),
        ),
      ).toBe(true);
    });

    it('refuses a user who logged in through the platform client', () => {
      expect(systemService().isSystemClient(jwt('platform', 'someone'))).toBe(
        false,
      );
    });

    it('refuses other clients and an empty azp', () => {
      expect(
        systemService().isSystemClient(jwt('other', 'service-account-other')),
      ).toBe(false);
      expect(systemService().isSystemClient(jwt('', 'service-account-'))).toBe(
        false,
      );
    });
  });

  describe('isKioskTokenRequest', () => {
    const kiosk = jwt('kiosk', 'service-account-kiosk');

    it('lets the kiosk service account mint its app clients', () => {
      expect(systemService().isKioskTokenRequest(kiosk, 'avatar')).toBe(true);
      expect(systemService().isKioskTokenRequest(kiosk, 'robot')).toBe(true);
    });

    it('refuses other app clients', () => {
      expect(systemService().isKioskTokenRequest(kiosk, 'application')).toBe(
        false,
      );
    });

    it('refuses users logged in through the kiosk client', () => {
      expect(
        systemService().isKioskTokenRequest(jwt('kiosk', 'someone'), 'avatar'),
      ).toBe(false);
    });

    it('is off without a kiosk secret', () => {
      expect(
        systemService({
          AUTH_KEYCLOAK_KIOSK_CLIENT_SECRET: '',
        }).isKioskTokenRequest(kiosk, 'avatar'),
      ).toBe(false);
    });
  });
});

describe('PlatformAuthService.isAppOwnerOrAdmin', () => {
  const owned = (ownerId?: string) =>
    new PlatformAuthService(
      new ConfigService({ AUTH_KEYCLOAK_SYSTEM_CLIENT_ID: '' }),
      {} as any,
      {
        findOne: () => ({ lean: async () => (ownerId ? { ownerId } : null) }),
      } as any,
    );
  const user = (sub: string, roles: string[] = []) =>
    ({ sub, realm_access: { roles } }) as unknown as AuthJwtUser;

  it('accepts the owner', async () => {
    expect(await owned('alice').isAppOwnerOrAdmin(user('alice'), 'a')).toBe(
      true,
    );
  });

  it('refuses another user, and an app without owner', async () => {
    expect(await owned('alice').isAppOwnerOrAdmin(user('bob'), 'a')).toBe(
      false,
    );
    expect(await owned().isAppOwnerOrAdmin(user('bob'), 'a')).toBe(false);
  });

  it('accepts a platform admin', async () => {
    expect(
      await owned('alice').isAppOwnerOrAdmin(
        user('bob', ['platform-admin']),
        'a',
      ),
    ).toBe(true);
  });
});

describe('PlatformAuthService.canAccessApp (app isolation)', () => {
  const apps: Record<string, any> = {
    a: { ownerId: 'alice', clients: [{ clientId: 'avatar' }] },
    b: { ownerId: 'bob', clients: [{ clientId: 'avatar' }] },
  };
  const svc = new PlatformAuthService(
    new ConfigService({
      AUTH_KEYCLOAK_CLIENT_ID: 'platform',
      AUTH_KEYCLOAK_SYSTEM_CLIENT_ID: '',
    }),
    {} as any,
    {
      findOne: ({ appId }: { appId: string }) => ({
        lean: async () => apps[appId] || null,
      }),
    } as any,
  );
  const token = (fields: Partial<AuthJwtUser> & Record<string, any>) =>
    ({ sub: 'u', azp: 'platform', ...fields }) as AuthJwtUser;

  it("lets an app's own client use that app only", async () => {
    const avatar = token({ azp: 'a-avatar' });
    expect(await svc.canAccessApp(avatar, 'a')).toBe(true);
    expect(await svc.canAccessApp(avatar, 'b')).toBe(false);
  });

  it('lets a user logged in to an app use it (azp <appId>-application)', async () => {
    expect(await svc.canAccessApp(token({ azp: 'a-application' }), 'a')).toBe(
      true,
    );
    expect(await svc.canAccessApp(token({ azp: 'a-application' }), 'b')).toBe(
      false,
    );
  });

  it('lets the owner, or a user with a role on the app, use it', async () => {
    expect(await svc.canAccessApp(token({ sub: 'alice' }), 'a')).toBe(true);
    expect(await svc.canAccessApp(token({ sub: 'alice' }), 'b')).toBe(false);
    const member = token({ resource_access: { 'b-application': {} } as any });
    expect(await svc.canAccessApp(member, 'b')).toBe(true);
    expect(await svc.canAccessApp(member, 'a')).toBe(false);
  });

  it('lets admins and system service accounts use every app', async () => {
    const admin = token({ realm_access: { roles: ['platform-admin'] } as any });
    expect(await svc.canAccessApp(admin, 'b')).toBe(true);
    const system = token({ preferred_username: 'service-account-platform' });
    expect(await svc.canAccessApp(system, 'b')).toBe(true);
  });

  it('refuses everyone else, and unknown or missing apps', async () => {
    const other = token({ sub: 'eve' });
    expect(await svc.canAccessApp(other, 'a')).toBe(false);
    expect(await svc.canAccessApp(other, 'nope')).toBe(false);
    expect(await svc.canAccessApp(other, undefined as any)).toBe(false);
  });

  it('app management is for the owner and admins, not app clients', async () => {
    await expect(
      svc.assertAppManager(token({ sub: 'alice' }), 'a'),
    ).resolves.toBeUndefined();
    await expect(
      svc.assertAppManager(token({ azp: 'a-avatar' }), 'a'),
    ).rejects.toThrow();
  });
});
