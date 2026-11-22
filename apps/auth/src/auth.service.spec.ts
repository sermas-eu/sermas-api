import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';

const create = () => {
  const keycloak = { login: vi.fn(async () => ({ access_token: 't' })) };
  const service = new AuthService(
    new ConfigService({ AUTH_KEYCLOAK_CLIENT_ID: 'platform' }),
    keycloak as any,
  );
  return { service, keycloak };
};

const credentials = { username: 'alice', password: 'secret' };

describe('AuthService.login', () => {
  it('logs in through the platform client by default', async () => {
    const { service, keycloak } = create();
    await service.login({ ...credentials } as any);
    expect(keycloak.login).toHaveBeenCalledWith('alice', 'secret', undefined);
  });

  it('logs in to an app through its application client', async () => {
    const { service, keycloak } = create();
    await service.login({ ...credentials, appId: 'app1' } as any);
    expect(keycloak.login).toHaveBeenCalledWith(
      'alice',
      'secret',
      'app1-application',
    );
  });

  it('refuses any other client', async () => {
    const { service, keycloak } = create();
    await expect(
      service.login({ ...credentials, clientId: 'app1-avatar' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(keycloak.login).not.toHaveBeenCalled();
  });
});
