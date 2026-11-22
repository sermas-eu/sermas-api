import { SermasValidationPipe } from '#libs/validation/validation-options';
import { CreatePlatformAppDto, PlatformAppDto } from './platform.app.dto.js';

// D-39: `modules` and `clients` were @ValidateNested without @Type, so the whitelist
// stripped every field of their items: apps were created with `modules: [{}]` and a
// client without clientId.
describe('app bodies through the validation pipe', () => {
  const body = {
    appId: 'demo',
    name: 'Demo',
    ownerId: 'u1',
    modules: [
      {
        moduleId: 'avatar',
        secret: null,
        supports: ['dialogue', 'ui'],
        config: { anything: { nested: true } },
        undeclared: 'dropped',
      },
    ],
    clients: [
      {
        clientId: 'avatar',
        name: 'Avatar',
        permissions: ['dialogue.*'],
        undeclared: 'dropped',
      },
    ],
  };

  for (const metatype of [CreatePlatformAppDto, PlatformAppDto]) {
    it(`${metatype.name} keeps module and client fields`, async () => {
      const out = await new SermasValidationPipe().transform(
        structuredClone(body),
        { type: 'body', metatype },
      );
      expect(out.modules).toHaveLength(1);
      expect(out.modules[0]).toMatchObject({
        moduleId: 'avatar',
        supports: ['dialogue', 'ui'],
        config: { anything: { nested: true } },
      });
      expect(out.modules[0].undeclared).toBeUndefined();
      expect(out.clients[0]).toMatchObject({
        clientId: 'avatar',
        name: 'Avatar',
        permissions: ['dialogue.*'],
      });
      expect(out.clients[0].undeclared).toBeUndefined();
    });
  }

  it('refuses a module without moduleId', async () => {
    const err = await new SermasValidationPipe()
      .transform(
        { ...structuredClone(body), modules: [{ supports: ['ui'] }] },
        { type: 'body', metatype: CreatePlatformAppDto },
      )
      .catch((e) => e);
    expect(err.getStatus?.()).toBe(400);
  });
});
