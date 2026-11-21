import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { AuthJwtUser } from '#apps/auth/src/auth.dto';
import {
  KeycloakService,
  ROLE_ADMIN,
} from '#apps/keycloak/src/keycloak.service';
import { getKeycloakClientId } from '#apps/keycloak/src/util';
import { jwtDecode } from '#libs/util';
import { Model } from 'mongoose';
import {
  PlatformApp,
  PlatformAppDocument,
} from '../app/platform.app.schema.js';
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
  private readonly appClients: Record<
    string,
    { clients: Set<string>; expires: number }
  > = {};

  constructor(
    private readonly config: ConfigService,
    private readonly keycloak: KeycloakService,
    @InjectModel(PlatformApp.name)
    private readonly apps: Model<PlatformAppDocument>,
  ) {
    this.allowedClients = [
      this.config.get('AUTH_KEYCLOAK_CLIENT_ID'),
      ...this.config
        .get('AUTH_KEYCLOAK_SYSTEM_CLIENT_ID')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
    ];
  }

  /**
   * The kiosk client's service account may mint tokens for the configured app
   * clients (AUTH_KEYCLOAK_KIOSK_APP_CLIENTS) of any app, and nothing else.
   */
  isKioskTokenRequest(user: AuthJwtUser, appClientId: string): boolean {
    const kiosk = this.config.get('AUTH_KEYCLOAK_KIOSK_CLIENT_ID');
    if (!kiosk || !this.config.get('AUTH_KEYCLOAK_KIOSK_CLIENT_SECRET'))
      return false;
    if (user.azp !== kiosk) return false;
    // a user who logged in through the kiosk client is not the kiosk
    if (user.preferred_username !== `service-account-${kiosk}`) return false;
    const allowed = (this.config.get('AUTH_KEYCLOAK_KIOSK_APP_CLIENTS') || '')
      .split(',')
      .map((c: string) => c.trim())
      .filter(Boolean);
    return allowed.includes(appClientId);
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

  /**
   * The caller is a system client's own service account. `azp` alone is not
   * enough: every user who logs in through the platform client carries
   * `azp=platform` too.
   */
  isSystemClient(user: AuthJwtUser): boolean {
    if (!user?.azp || !this.allowedClients.includes(user.azp)) return false;
    return user.preferred_username === `service-account-${user.azp}`;
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
   * Whether `clientId` (a token's `azp`) is one of the app's own clients, e.g.
   * `myapp-avatar` for app `myapp`. The app's clients come from its record, so
   * a client of app `myapp-x` never counts for app `myapp`.
   */
  /** The caller is a platform admin, or the user who owns the app. */
  async isAppOwnerOrAdmin(user: AuthJwtUser, appId: string): Promise<boolean> {
    if (!user?.sub) return false;
    if (user.realm_access?.roles?.includes(ROLE_ADMIN)) return true;
    if (!appId) return false;
    const app = await this.apps
      .findOne({ appId }, { ownerId: 1 })
      .lean<Pick<PlatformApp, 'ownerId'>>();
    return Boolean(app?.ownerId) && app.ownerId === user.sub;
  }

  async isOwnAppClient(appId: string, clientId: string): Promise<boolean> {
    if (!appId || !clientId) return false;
    let entry = this.appClients[appId];
    if (!entry || entry.expires < Date.now()) {
      const app = await this.apps
        .findOne({ appId }, { clients: 1 })
        .lean<Pick<PlatformApp, 'clients'>>();
      entry = {
        clients: new Set(
          (app?.clients || []).map((c) =>
            getKeycloakClientId(appId, c.clientId),
          ),
        ),
        expires: Date.now() + CACHE_TTL_SECONDS * 1000,
      };
      this.appClients[appId] = entry;
    }
    return entry.clients.has(clientId);
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
