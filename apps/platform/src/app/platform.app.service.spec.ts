import { BadRequestException } from '@nestjs/common';
import { PlatformAppService } from './platform.app.service.js';

// D-27: the owner is checked before anything is saved
describe('PlatformAppService owner validation', () => {
  const setup = (existingUsers: string[]) => {
    const saved: unknown[] = [];
    const model: any = function (this: any, data: any) {
      Object.assign(this, data);
      this.save = async () => saved.push(data);
    };
    model.findOne = () => ({ exec: async () => null });
    const keycloak = {
      getUserById: vi.fn(async (id: string) =>
        existingUsers.includes(id) ? { id } : null,
      ),
    };
    const cache = { del: vi.fn() };
    const service = new PlatformAppService(
      model,
      {} as any,
      keycloak as any,
      { get: () => undefined } as any,
      {} as any,
      cache as any,
    );
    return { service, saved, keycloak };
  };

  it('rejects an unknown owner without saving the app', async () => {
    const { service, saved } = setup([]);
    await expect(
      service.createApp({ data: { appId: 'x', ownerId: 'nobody' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(saved).toHaveLength(0);
  });

  it('checks the owner of an existing user', async () => {
    const { service, keycloak } = setup(['u1']);
    // stop after the check: the rest of createApp needs a full model
    vi.spyOn(service, 'updateApp').mockResolvedValue({} as any);
    await service.createApp({ data: { appId: 'x', ownerId: 'u1' } });
    expect(keycloak.getUserById).toHaveBeenCalledWith('u1');
  });
});
