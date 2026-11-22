import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { AuthJwtUser } from '#apps/auth/src/auth.dto';
import {
  KeycloakService,
  ROLE_ADMIN,
} from '#apps/keycloak/src/keycloak.service';
import { LocalKeycloakService } from '#apps/keycloak/src/local/local-keycloak.service';
import { getKeycloakClientId } from '#apps/keycloak/src/util';
import { jwtDecode } from '#libs/util';
import type { Connection } from 'mongoose';
import { Model } from 'mongoose';
import {
  PlatformApp,
  PlatformAppDocument,
} from '../app/platform.app.schema.js';
import { PlatformContextDto } from './platform.auth.dto.js';

// an app's own login client, `<appId>-application` (APP_CLIENT_NAME in
// platform.keycloack.service.ts, not imported here to keep this module a leaf)
const APP_CLIENT_NAME = 'application';

const OWNER_SCOPES = ['app', 'app:editor', 'client', 'module', 'monitoring'];

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
  private readonly appInfo: Record<
    string,
    { clients: Set<string>; ownerId?: string; expires: number }
  > = {};

  constructor(
    private readonly config: ConfigService,
    private readonly keycloak: KeycloakService,
    @InjectModel(PlatformApp.name)
    private readonly apps: Model<PlatformAppDocument>,
    @InjectConnection()
    private readonly connection?: Connection,
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
    for (const [key, v] of Object.entries(this.sessionApps))
      if (v.expires < now) delete this.sessionApps[key];
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
  isPlatformAdmin(user: AuthJwtUser): boolean {
    return Boolean(user?.realm_access?.roles?.includes(ROLE_ADMIN));
  }

  /** The app's clients (Keycloak names) and owner, cached briefly. */
  private async loadAppInfo(appId: string) {
    let entry = this.appInfo[appId];
    if (!entry || entry.expires < Date.now()) {
      const app = await this.apps
        .findOne({ appId }, { clients: 1, ownerId: 1 })
        .lean<Pick<PlatformApp, 'clients' | 'ownerId'>>();
      entry = {
        clients: new Set(
          (app?.clients || []).map((c) =>
            getKeycloakClientId(appId, c.clientId),
          ),
        ),
        ownerId: app?.ownerId,
        expires: Date.now() + CACHE_TTL_SECONDS * 1000,
      };
      this.appInfo[appId] = entry;
    }
    return entry;
  }

  /** The caller is a platform admin, or the user who owns the app. */
  async isAppOwnerOrAdmin(user: AuthJwtUser, appId: string): Promise<boolean> {
    if (!user?.sub) return false;
    if (this.isPlatformAdmin(user)) return true;
    if (!appId) return false;
    const { ownerId } = await this.loadAppInfo(appId);
    return Boolean(ownerId) && ownerId === user.sub;
  }

  async isOwnAppClient(appId: string, clientId: string): Promise<boolean> {
    if (!appId || !clientId) return false;
    if (clientId === getKeycloakClientId(appId, APP_CLIENT_NAME)) return true;
    return (await this.loadAppInfo(appId)).clients.has(clientId);
  }

  /**
   * App isolation: may this caller act on this app's data? System service
   * accounts and platform admins may act on every app; anyone else only through
   * one of the app's own clients (an app token, or a user logged in to the app),
   * as a user holding a role on the app (owners), or as its owner.
   */
  async canAccessApp(user: AuthJwtUser, appId: string): Promise<boolean> {
    if (!user?.sub || !appId || typeof appId !== 'string') return false;
    if (this.isSystemClient(user) || this.isPlatformAdmin(user)) return true;
    if (await this.isOwnAppClient(appId, user.azp)) return true;
    const appClient = getKeycloakClientId(appId, APP_CLIENT_NAME);
    if (user.resource_access?.[appClient]) return true;
    const { ownerId } = await this.loadAppInfo(appId);
    return Boolean(ownerId) && ownerId === user.sub;
  }

  private readonly sessionApps: Record<
    string,
    { appId: string | null; expires: number }
  > = {};

  /**
   * The app a session belongs to, or null for an unknown session. Read from the
   * sessions collection directly: the session module depends on this one.
   */
  async getSessionAppId(sessionId: string): Promise<string | null> {
    if (!sessionId || typeof sessionId !== 'string' || !this.connection)
      return null;
    const cached = this.sessionApps[sessionId];
    if (cached && cached.expires > Date.now()) return cached.appId;
    const doc = await this.connection
      .collection('sessions')
      .findOne({ sessionId }, { projection: { appId: 1 } });
    const appId = (doc?.appId as string) || null;
    // a session never changes app; unknown ones may be created any moment
    if (appId)
      this.sessionApps[sessionId] = {
        appId,
        expires: Date.now() + 10 * 60 * 1000,
      };
    return appId;
  }

  /**
   * Scopes every user logged in through the platform client holds, so that
   * owners can create and manage their own apps (D-38). Each route under them
   * checks the app: app access in the guard, `assertAppManager` for changes,
   * `assertPlatformAdmin` for global modules; `/app/list` lists own apps.
   */
  isOwnerScope(user: AuthJwtUser, resource: string, scopes: string[]) {
    if (resource !== 'platform' || !user?.sub) return false;
    if (user.azp !== this.config.get('AUTH_KEYCLOAK_CLIENT_ID')) return false;
    // a service account is not a user
    if (user.preferred_username?.startsWith('service-account-')) return false;
    return (scopes || []).some((s) => OWNER_SCOPES.includes(s));
  }

  /** Throws 403 unless canAccessApp. */
  async assertAppAccess(user: AuthJwtUser, appId: string): Promise<void> {
    if (!(await this.canAccessApp(user, appId)))
      throw new ForbiddenException(`No access to app ${appId}`);
  }

  /**
   * Managing an app (settings, tools, clients and their secrets, modules,
   * removal) is for its owner, platform admins and system service accounts;
   * the app's own clients may use the app, not manage it.
   */
  async assertAppManager(user: AuthJwtUser, appId: string): Promise<void> {
    if (this.isSystemClient(user)) return;
    if (!(await this.isAppOwnerOrAdmin(user, appId)))
      throw new ForbiddenException(`Not a manager of app ${appId}`);
  }

  /** Throws 403 unless the caller is a system service account or an admin. */
  assertPlatformAdmin(user: AuthJwtUser): void {
    if (!this.isSystemClient(user) && !this.isPlatformAdmin(user))
      throw new ForbiddenException();
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
    // AUTH_PROVIDER=local: the client's declared permissions, no Keycloak
    const local: unknown = this.keycloak;
    if (local instanceof LocalKeycloakService) {
      return local.isAllowed(payload);
    }
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
