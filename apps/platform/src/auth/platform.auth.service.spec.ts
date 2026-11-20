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
