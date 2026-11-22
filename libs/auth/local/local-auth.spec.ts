import { generateKeyPairSync } from 'crypto';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getLocalJwks,
  getLocalKey,
  isLocalAuth,
  resetLocalKey,
} from './local-auth.js';

describe('isLocalAuth', () => {
  const env = (v?: string) => (k: string) =>
    k === 'AUTH_PROVIDER' ? v : undefined;

  it('local is the default', () => {
    expect(isLocalAuth(env(undefined))).toBe(true);
    expect(isLocalAuth(env(''))).toBe(true);
    expect(isLocalAuth(env(' Local '))).toBe(true);
  });

  it('keycloak only when asked for', () => {
    expect(isLocalAuth(env('keycloak'))).toBe(false);
    expect(isLocalAuth(env('KEYCLOAK'))).toBe(false);
  });

  it('refuses anything else', () => {
    expect(() => isLocalAuth(env('keycloack'))).toThrow(/local or keycloak/);
  });
});

describe('getLocalKey', () => {
  let dir: string;
  const env = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'local-auth-'));
    process.env.AUTH_LOCAL_SIGNING_KEY_FILE = join(dir, 'key.pem');
    delete process.env.AUTH_LOCAL_SIGNING_KEY;
    resetLocalKey();
  });

  afterEach(() => {
    process.env = { ...env };
    resetLocalKey();
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the key across a restart, so issued tokens stay valid', () => {
    const before = getLocalKey();
    resetLocalKey();
    const after = getLocalKey();
    expect(after.kid).toBe(before.kid);
    expect(getLocalJwks().keys[0].n).toBe(
      before.publicKey.export({ format: 'jwk' }).n,
    );
  });

  it('writes the generated key readable by its owner only', () => {
    getLocalKey();
    const mode = statSync(join(dir, 'key.pem')).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('takes the key from AUTH_LOCAL_SIGNING_KEY, escaped newlines included', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    process.env.AUTH_LOCAL_SIGNING_KEY = pem.replace(/\n/g, '\\n');
    const { publicKey } = getLocalKey();
    expect(publicKey.export({ format: 'jwk' }).n).toBe(
      privateKey.export({ format: 'jwk' }).n,
    );
    expect(() => statSync(join(dir, 'key.pem'))).toThrow();
  });

  it('replaces an unreadable key file', () => {
    getLocalKey();
    const first = getLocalKey().kid;
    resetLocalKey();
    writeFileSync(join(dir, 'key.pem'), 'not a key');
    expect(getLocalKey().kid).not.toBe(first);
  });
});
