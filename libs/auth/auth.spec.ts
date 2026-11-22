import type { Mocked } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import axios from 'axios';
import { generateKeyPairSync, KeyObject } from 'crypto';
import jwt from 'jsonwebtoken';

const { sign } = jwt;
import { META_PUBLIC, META_ROLES } from './auth.constants.js';
import { extractToken, JwtAuthGuard } from './jwt.guard.js';
import { JwtVerifierService } from './jwt.verifier.service.js';
import { RoleGuard } from './role.guard.js';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

const REALM = 'sermas-test';
const BACKCHANNEL = 'http://172.17.0.1:8080/keycloak';
const ISSUER = `${BACKCHANNEL}/realms/${REALM}`;

const makeKey = (kid: string) => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = {
    ...(publicKey.export({ format: 'jwk' }) as object),
    kid,
    use: 'sig',
    alg: 'RS256',
  };
  return { privateKey, jwk };
};

const config = (values: Record<string, string>) => {
  const c = new ConfigService();
  for (const [k, v] of Object.entries(values)) c.set(k, v);
  return c;
};

const token = (
  privateKey: KeyObject,
  kid: string,
  payload: Record<string, unknown> = {},
  issuer = ISSUER,
) =>
  sign({ sub: 'user-1', azp: 'client-1', ...payload }, privateKey, {
    algorithm: 'RS256',
    keyid: kid,
    issuer,
    expiresIn: 60,
  });

const httpContext = (
  request: any,
  metadata: Record<string, unknown> = {},
): [ExecutionContext, Reflector] => {
  const handler = () => undefined;
  const ctx = {
    getType: () => 'http',
    getClass: () => class Ctrl {},
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
  return [ctx, reflector];
};

describe('libs/auth', () => {
  const key = makeKey('k1');

  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.get.mockResolvedValue({ data: { keys: [key.jwk] } });
  });

  const verifier = (extra: Record<string, string> = {}) =>
    new JwtVerifierService(
      config({
        // the JWKS path; local auth (the default) is covered in libs/auth/local
        AUTH_PROVIDER: 'keycloak',
        AUTH_KEYCLOAK_REALM: REALM,
        AUTH_KEYCLOAK_URL: BACKCHANNEL,
        ...extra,
      }),
    );

  describe('JwtVerifierService', () => {
    it('fetches the JWKS from the backchannel URL', () => {
      expect(verifier().jwksUrl).toBe(
        `${BACKCHANNEL}/realms/${REALM}/protocol/openid-connect/certs`,
      );
    });

    it('accepts a token signed by the realm key with the default issuer', async () => {
      const payload = await verifier().verify(token(key.privateKey, 'k1'));
      expect(payload.sub).toBe('user-1');
    });

    it('defaults the issuer to the frontend URL when one is set', async () => {
      const v = verifier({
        AUTH_KEYCLOAK_FRONTEND_URL: 'http://localhost:8080/keycloak/',
      });
      expect(v.issuers).toEqual([
        `http://localhost:8080/keycloak/realms/${REALM}`,
      ]);
    });

    it('accepts any issuer from AUTH_KEYCLOAK_ISSUERS', async () => {
      const other = `http://localhost:8080/keycloak/realms/${REALM}`;
      const v = verifier({ AUTH_KEYCLOAK_ISSUERS: `${ISSUER}, ${other}` });
      await expect(
        v.verify(token(key.privateKey, 'k1', {}, other)),
      ).resolves.toBeTruthy();
    });

    it('rejects a token from another issuer', async () => {
      await expect(
        verifier().verify(
          token(key.privateKey, 'k1', {}, 'http://evil/realms/x'),
        ),
      ).rejects.toThrow(/issuer/);
    });

    it('rejects a token signed by a key not in the JWKS', async () => {
      const stranger = makeKey('k1');
      await expect(
        verifier().verify(token(stranger.privateKey, 'k1')),
      ).rejects.toThrow(/signature/);
    });

    it('rejects an expired token', async () => {
      const expired = sign(
        { sub: 'u', exp: Math.floor(Date.now() / 1000) - 10 },
        key.privateKey,
        { algorithm: 'RS256', keyid: 'k1', issuer: ISSUER },
      );
      await expect(verifier().verify(expired)).rejects.toThrow(/expired/);
    });

    it('rejects an unsigned token', async () => {
      const none = sign({ sub: 'u' }, '', {
        algorithm: 'none',
        issuer: ISSUER,
      });
      await expect(verifier().verify(none)).rejects.toThrow();
    });

    it('fetches the JWKS once for many tokens', async () => {
      const v = verifier();
      await v.verify(token(key.privateKey, 'k1'));
      await v.verify(token(key.privateKey, 'k1'));
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('extractToken', () => {
    it('reads a Bearer header', () => {
      expect(extractToken({ headers: { authorization: 'Bearer abc' } })).toBe(
        'abc',
      );
    });
    it('falls back to the KEYCLOAK_JWT cookie', () => {
      expect(
        extractToken({ headers: { cookie: 'a=1; KEYCLOAK_JWT=xyz' } }),
      ).toBe('xyz');
    });
    it('returns undefined without either', () => {
      expect(extractToken({ headers: {} })).toBeUndefined();
    });
  });

  describe('JwtAuthGuard', () => {
    it('sets the user and the raw token on a valid request', async () => {
      const t = token(key.privateKey, 'k1');
      const request = { headers: { authorization: `Bearer ${t}` } } as any;
      const [ctx, reflector] = httpContext(request);
      await expect(
        new JwtAuthGuard(reflector, verifier()).canActivate(ctx),
      ).resolves.toBe(true);
      expect(request.user.sub).toBe('user-1');
      expect(request.accessTokenJWT).toBe(t);
    });

    it('rejects a protected route without a token', async () => {
      const [ctx, reflector] = httpContext({ headers: {} });
      await expect(
        new JwtAuthGuard(reflector, verifier()).canActivate(ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a protected route with an invalid token', async () => {
      const [ctx, reflector] = httpContext({
        headers: { authorization: 'Bearer not-a-jwt' },
      });
      await expect(
        new JwtAuthGuard(reflector, verifier()).canActivate(ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lets a public route through without a token, and without a user', async () => {
      const request = { headers: {} } as any;
      const [ctx, reflector] = httpContext(request, { [META_PUBLIC]: true });
      await expect(
        new JwtAuthGuard(reflector, verifier()).canActivate(ctx),
      ).resolves.toBe(true);
      expect(request.user).toBeUndefined();
    });

    it('lets a public route through with an invalid token, without a user', async () => {
      const request = { headers: { authorization: 'Bearer bad' } } as any;
      const [ctx, reflector] = httpContext(request, { [META_PUBLIC]: true });
      await expect(
        new JwtAuthGuard(reflector, verifier()).canActivate(ctx),
      ).resolves.toBe(true);
      expect(request.user).toBeUndefined();
    });
  });

  describe('RoleGuard', () => {
    const user = { realm_access: { roles: ['admin', 'other'] } };

    it('passes when no roles are required', () => {
      const [ctx, reflector] = httpContext({ user });
      expect(new RoleGuard(reflector).canActivate(ctx)).toBe(true);
    });

    it('passes when every required realm role is granted', () => {
      const [ctx, reflector] = httpContext(
        { user },
        { [META_ROLES]: ['realm:admin', 'other'] },
      );
      expect(new RoleGuard(reflector).canActivate(ctx)).toBe(true);
    });

    it('forbids when a required role is missing', () => {
      const [ctx, reflector] = httpContext(
        { user },
        { [META_ROLES]: ['realm:admin', 'realm:root'] },
      );
      expect(() => new RoleGuard(reflector).canActivate(ctx)).toThrow(
        ForbiddenException,
      );
    });

    it('forbids when there is no user', () => {
      const [ctx, reflector] = httpContext({}, { [META_ROLES]: ['admin'] });
      expect(() => new RoleGuard(reflector).canActivate(ctx)).toThrow(
        ForbiddenException,
      );
    });
  });
});
