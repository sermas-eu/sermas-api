import { generateKeyPairSync, KeyObject, randomBytes } from 'crypto';

/**
 * AUTH_PROVIDER=local: the API issues and verifies its own tokens, with users and
 * clients from env, instead of a Keycloak. For a single-instance demo only: the
 * signing key and refresh tokens live in this process and die with it.
 */
export const isLocalAuth = (get: (key: string) => string | undefined) =>
  (get('AUTH_PROVIDER') || '').trim().toLowerCase() === 'local';

type LocalKey = { kid: string; privateKey: KeyObject; publicKey: KeyObject };

let key: LocalKey | undefined;

/** The process's signing key, generated on first use; a restart replaces it. */
export const getLocalKey = (): LocalKey => {
  if (!key) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    key = { kid: randomBytes(8).toString('hex'), privateKey, publicKey };
  }
  return key;
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
