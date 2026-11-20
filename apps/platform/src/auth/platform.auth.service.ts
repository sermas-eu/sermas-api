import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { KeycloakService } from '#apps/keycloak/src/keycloak.service';
import { getKeycloakClientId } from '#apps/keycloak/src/util';
import { jwtDecode } from '#libs/util';
import { PlatformContextDto } from './platform.auth.dto.js';

// guard cache in seconds
const CACHE_TTL_SECONDS = 30;

interface TokenCache {
  expires: number;
  isAllowed: boolean;
}

@Injectable()
export class PlatformAuthService {
  private readonly logger = new Logger(PlatformAuthService.name);

  private readonly allowedClients: string[];

  private readonly cache: Record<string, TokenCache> = {};

  constructor(
    private readonly config: ConfigService,
    private readonly keycloak: KeycloakService,
  ) {
    this.allowedClients = [
      this.config.get('AUTH_KEYCLOAK_CLIENT_ID'),
      ...this.config
        .get('AUTH_KEYCLOAK_SYSTEM_CLIENT_ID')
        .split(',')
        .map((p) => p.trim()),
    ];
  }

  getPlatformClientName() {
    return this.keycloak.getPlatformClientName();
  }

  @Interval(10 * 1000)
  public clearExpiredCache() {
    const now = Date.now();
    Object.entries(this.cache).forEach(([key, c]) => {
      if (c.expires < now) this.clearCache(key);
    });
  }

  public clearCache(key: string) {
    if (this.cache[key]) delete this.cache[key];
  }

  isSystemClient(clientId: string): boolean {
    return this.allowedClients.includes(clientId);
  }

  parseToken(token: string) {
    if (!token) return null;
    try {
      return jwtDecode<AuthJwtUser>(token);
    } catch (e: any) {
      this.logger.warn(`Failed to parse token: ${e.stack}`);
    }
    return null;
  }

  /**
   * Whether the caller may use `scopes` on `resource`. The answer depends on
   * the client, the user and the app, so all of them are in the cache key;
   * a cached answer skips the Keycloak calls.
   */
  async isAllowed(payload: PlatformContextDto): Promise<boolean> {
    if (!payload.clientId) throw new BadRequestException(`clientId is missing`);

    const cacheKey = JSON.stringify([
      payload.clientId,
      payload.userId || null,
      payload.appId || null,
      payload.resource,
      [...(payload.scopes || [])].sort(),
    ]);
    const cached = this.cache[cacheKey];
    if (cached && cached.expires > Date.now()) return cached.isAllowed;

    const isAllowed = await this.evaluate(payload);
    if (isAllowed !== null) {
      this.cache[cacheKey] = {
        isAllowed,
        expires: Date.now() + CACHE_TTL_SECONDS * 1000,
      };
    }
    return isAllowed === true;
  }

  /** Asks Keycloak; null when it could not answer (not cached). */
  private async evaluate(payload: PlatformContextDto): Promise<boolean | null> {
    let clientId = payload.clientId;
    let scopes: string[];

    try {
      let client = await this.keycloak.getClientByName(clientId);
      if (!client) {
        if (payload.appId && !payload.clientId.startsWith(payload.appId)) {
          clientId = getKeycloakClientId(payload.appId, payload.clientId);
        }
        this.logger.verbose(
          `Client ${payload.clientId} not found, trying ${clientId}`,
        );
        client = await this.keycloak.getClientByName(clientId);
      }

      if (!client)
        throw new NotFoundException(
          `Client clientId=${clientId} not found appId=${payload.appId} `,
        );
      const clientScopes = await this.keycloak.getClientScopes(client.id);
      scopes = (payload.scopes || [])
        .map((scope) => `${payload.resource}:${scope}`)
        .filter((scope) => clientScopes.some(({ name }) => name === scope));
    } catch (e: any) {
      this.logger.error(`Failed to load client scopes: ${e.message}`);
      return null;
    }

    if (!scopes.length) {
      this.logger.warn(
        `Client ${payload.clientId} does not have matching scopes ${(payload.scopes || []).join(',')}`,
      );
      return false;
    }

    try {
      const res = await this.keycloak.evaluatePermission(clientId, {
        context: {},
        entitlements: false,
        roleIds: [],
        userId: payload.userId,
        resources: [
          {
            name: payload.resource,
            scopes: scopes.map((name) => ({ name })),
          },
        ],
      });
      return res.status === 'PERMIT';
    } catch (e) {
      this.logger.error(
        `Failed to evaluatePermission clientId=${clientId}: ${e.message}`,
      );
      return null;
    }
  }
}
