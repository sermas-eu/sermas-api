import { Logger } from '@nestjs/common';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
} from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

/**
 * AUTH_PROVIDER=local (the default): the API issues and verifies its own tokens,
 * with users and clients from env, instead of a Keycloak. For a single-instance demo only:
 * refresh tokens live in this process and die with it. The signing key survives a
 * restart (ADR-0004), so access tokens stay valid until they expire.
 */
export const isLocalAuth = (get: (key: string) => string | undefined) => {
  // local is the default (ADR-0003); a typo must not silently pick a provider
  const provider = (get('AUTH_PROVIDER') || 'local').trim().toLowerCase();
  if (provider !== 'local' && provider !== 'keycloak') {
    throw new Error(
      `AUTH_PROVIDER must be local or keycloak, not "${provider}"`,
    );
  }
  return provider === 'local';
};

type LocalKey = { kid: string; privateKey: KeyObject; publicKey: KeyObject };

const logger = new Logger('LocalAuth');

let key: LocalKey | undefined;

/** Where the generated key is kept between restarts. */
export const getLocalKeyFile = () =>
  process.env.AUTH_LOCAL_SIGNING_KEY_FILE?.trim() ||
  join(tmpdir(), 'sermas-auth-local-key.pem');

/**
 * The private key: AUTH_LOCAL_SIGNING_KEY (PEM) when set, else the one kept in
 * getLocalKeyFile(), generated and written there on first start. Read from
 * process.env: the key is needed before any module holds a ConfigService.
 */
const loadPrivateKey = (): KeyObject => {
  // a PEM in an env file often comes with escaped newlines
  const pem = process.env.AUTH_LOCAL_SIGNING_KEY?.trim().replace(/\\n/g, '\n');
  if (pem) return createPrivateKey(pem);

  const file = getLocalKeyFile();
  try {
    return createPrivateKey(readFileSync(file, 'utf8'));
  } catch (e: any) {
    if (e?.code !== 'ENOENT') {
      logger.warn(
        `Signing key in ${file} unreadable, replacing it: ${e.message}`,
      );
    }
  }

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
      { mode: 0o600 },
    );
    logger.log(`Signing key generated and kept in ${file}`);
  } catch (e: any) {
    // still usable: tokens just do not survive the next restart
    logger.warn(`Signing key not kept in ${file}: ${e.message}`);
  }
  return privateKey;
};

/** The signing key, loaded on first use; its kid is derived from it, so it is stable. */
export const getLocalKey = (): LocalKey => {
  if (!key) {
    const privateKey = loadPrivateKey();
    const publicKey = createPublicKey(privateKey);
    const kid = createHash('sha256')
      .update(publicKey.export({ type: 'spki', format: 'der' }))
      .digest('base64url')
      .slice(0, 16);
    key = { kid, privateKey, publicKey };
  }
  return key;
};

/** Forgets the loaded key, as a restart would (tests). */
export const resetLocalKey = () => {
  key = undefined;
};

/** The JWKS document a Keycloak serves at `.../openid-connect/certs`. */
export const getLocalJwks = () => {
  const { kid, publicKey } = getLocalKey();
  return {
    keys: [
      { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' },
    ],
  };
};
