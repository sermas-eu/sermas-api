import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createPublicKey, KeyObject } from 'crypto';
import { decode, JwtPayload, verify } from 'jsonwebtoken';

type Jwk = { kid: string; kty: string; use?: string; alg?: string };

const JWKS_MIN_REFRESH_MS = 30 * 1000;

/**
 * Verifies Keycloak access tokens as plain OIDC JWTs: signature against the realm's
 * JWKS, expiry, and an issuer from a configured list.
 *
 * Issuers: AUTH_KEYCLOAK_ISSUERS (comma separated), or else the realm URL built from
 * AUTH_KEYCLOAK_FRONTEND_URL, falling back to AUTH_KEYCLOAK_URL. The JWKS is always
 * fetched from AUTH_KEYCLOAK_URL, the address the API itself reaches Keycloak on.
 */
@Injectable()
export class JwtVerifierService {
  private readonly logger = new Logger(JwtVerifierService.name);

  private keys: Record<string, KeyObject> = {};
  private lastFetch = 0;
  private fetching?: Promise<void>;

  readonly issuers: string[];
  readonly jwksUrl: string;

  constructor(private readonly config: ConfigService) {
    const realm = this.config.get<string>('AUTH_KEYCLOAK_REALM');
    const url = this.trim(this.config.get<string>('AUTH_KEYCLOAK_URL'));
    const frontend = this.trim(
      this.config.get<string>('AUTH_KEYCLOAK_FRONTEND_URL'),
    );

    this.jwksUrl = `${url}/realms/${realm}/protocol/openid-connect/certs`;

    const configured = (this.config.get<string>('AUTH_KEYCLOAK_ISSUERS') || '')
      .split(',')
      .map((i) => this.trim(i))
      .filter((i) => i);
    this.issuers = configured.length
      ? configured
      : [`${frontend || url}/realms/${realm}`];
  }

  private trim(v?: string) {
    return (v || '').trim().replace(/\/+$/, '');
  }

  /** Returns the verified payload, or throws. */
  async verify<T extends JwtPayload = JwtPayload>(token: string): Promise<T> {
    const decoded = decode(token, { complete: true });
    if (!decoded || typeof decoded.payload === 'string') {
      throw new Error('malformed token');
    }
    const kid = decoded.header.kid;
    const key = await this.getKey(kid);
    if (!key) throw new Error(`unknown signing key kid=${kid}`);

    return verify(token, key, {
      issuer: this.issuers as [string, ...string[]],
      algorithms: ['RS256', 'RS384', 'RS512', 'PS256', 'ES256'],
    }) as T;
  }

  private async getKey(kid?: string): Promise<KeyObject | undefined> {
    if (kid && this.keys[kid]) return this.keys[kid];
    // An unknown kid may be a rotated key: refetch, but not more than once per
    // JWKS_MIN_REFRESH_MS, so a stream of bad tokens cannot hammer Keycloak.
    if (Date.now() - this.lastFetch >= JWKS_MIN_REFRESH_MS || !this.lastFetch) {
      await this.refresh();
    }
    if (!kid) {
      const all = Object.values(this.keys);
      return all.length === 1 ? all[0] : undefined;
    }
    return this.keys[kid];
  }

  private refresh(): Promise<void> {
    if (!this.fetching) {
      this.fetching = (async () => {
        try {
          const res = await axios.get<{ keys: Jwk[] }>(this.jwksUrl, {
            timeout: 5000,
          });
          const keys: Record<string, KeyObject> = {};
          for (const jwk of res.data.keys || []) {
            if (jwk.use && jwk.use !== 'sig') continue;
            try {
              keys[jwk.kid] = createPublicKey({
                key: jwk as any,
                format: 'jwk',
              });
            } catch (e: any) {
              this.logger.warn(`Skipping JWK kid=${jwk.kid}: ${e.message}`);
            }
          }
          this.keys = keys;
          this.lastFetch = Date.now();
        } catch (e: any) {
          this.lastFetch = Date.now();
          this.logger.error(
            `Failed to fetch JWKS ${this.jwksUrl}: ${e.message}`,
          );
        } finally {
          this.fetching = undefined;
        }
      })();
    }
    return this.fetching;
  }
}
