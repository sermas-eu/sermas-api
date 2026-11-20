import { UnauthorizedException } from '@nestjs/common';
import { PlatformAuthTokenController } from './platform.token.controller.js';

const controller = () => {
  const token = {
    getClientAccessToken: vi.fn(async () => ({ access_token: 't' })),
  };
  return { c: new PlatformAuthTokenController(token as any), token };
};

const payload = { appId: 'app1', clientId: 'avatar' } as any;

describe('PlatformAuthTokenController.getClientAccessToken', () => {
  it('refuses a bearer token the JWT guard did not verify', () => {
    const { c, token } = controller();
    const req = { headers: { authorization: 'Bearer forged' } } as any;
    expect(() => c.getClientAccessToken(payload, req)).toThrow(
      UnauthorizedException,
    );
    expect(token.getClientAccessToken).not.toHaveBeenCalled();
  });

  it('passes on the verified identity, never the raw header', async () => {
    const { c, token } = controller();
    const user = { azp: 'platform', sub: 'u1' };
    const req = {
      headers: { authorization: 'Bearer good' },
      user,
      accessTokenJWT: 'good',
    } as any;
    await c.getClientAccessToken(payload, req);
    expect(token.getClientAccessToken).toHaveBeenCalledWith(payload, {
      user,
      token: 'good',
    });
  });

  it('allows a request without a token (client secret flow)', async () => {
    const { c, token } = controller();
    await c.getClientAccessToken(payload, { headers: {} } as any);
    expect(token.getClientAccessToken).toHaveBeenCalledWith(payload, undefined);
  });
});
