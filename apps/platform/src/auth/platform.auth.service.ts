import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { KeycloakService } from 'apps/keycloak/src/keycloak.service';
import { getKeycloakClientId } from 'apps/keycloak/src/util';
import { jwtDecode } from 'libs/util';
import { PlatformContextDto } from './platform.auth.dto';

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

  async isAllowed(payload: PlatformContextDto): Promise<boolean> {
    let scopes: string[] = [];

    let clientId = payload.clientId;
    if (!clientId) throw new BadRequestException(`clientId is missing`);

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
      const reqScopes = payload.scopes || [];
      scopes = reqScopes
        .map((scope) => `${payload.resource}:${scope}`)
        .filter(
          (scope) => clientScopes.filter(({ name }) => name === scope).length,
        );
    } catch (e: any) {
      this.logger.error(`Failed to load client scopes: ${e.message}`);
      return false;
    }

    // if (payload.appId) {
    //   const apps = this.keycloak.getServiceAccountsApps(payload.clientId);
    //   if (!(await apps).includes(payload.appId)) {
    //     this.logger.warn(
    //       `Client ${payload.clientId} does not have access to appId=${payload.appId}`,
    //     );
    //     return false;
    //   }
    // }

    if (!scopes.length) {
      this.logger.warn(
        `Client ${
          payload.clientId
        } does not have matching scopes ${payload.scopes.join(',')}`,
      );
      return false;
    }

    const data = {
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
    };

    const cacheKey = [
      payload.appId || payload.userId,
      payload.resource,
      ...scopes,
    ].join('-');

    if (this.cache[cacheKey]) {
      return this.cache[cacheKey].isAllowed;
    }

    let isAllowed = false;
    try {
      const res = await this.keycloak.evaluatePermission(clientId, data);
      isAllowed = res.status === 'PERMIT';
    } catch (e) {
      this.logger.debug(
        `evaluatePermission clientId=${clientId} data=${JSON.stringify(data)}`,
      );
      this.logger.error(`Failed to evaluatePermission: ${e.message}`);
      return false;
    }

    this.cache[cacheKey] = {
      isAllowed,
      expires: Date.now() + CACHE_TTL_SECONDS * 1000,
    };

    return isAllowed;
  }
}
