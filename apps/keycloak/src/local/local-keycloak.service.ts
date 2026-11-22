import {
  ForbiddenException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import type { Connection } from 'mongoose';
import { getLocalKey } from '#libs/auth/local/local-auth';
import { ROLE_ADMIN } from '../keycloak.service.js';

const { sign } = jwt;

export type LocalClient = {
  /** the Keycloak-style name: `platform`, `kiosk`, `<appId>-<clientId>` */
  clientId: string;
  secret: string;
  /** `resource.scope` permissions as in an app client; `*` is everything */
  permissions: string[];
  appId?: string;
  /** platform and system clients: may act on every app */
  system?: boolean;
};

type RefreshEntry = {
  kind: 'user' | 'client';
  subject: string;
  clientId: string;
  expires: number;
};

export type LocalTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: 'Bearer';
  'not-before-policy': number;
  session_state: string;
  scope: string;
};

const ADMIN_SUB = 'local-admin';
const DEFAULT_SECRETS = ['platform', 'admin', ''];
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MS = 5 * 60 * 1000;

const digest = (v: string) => createHash('sha256').update(v).digest();
const sameSecret = (a: string, b: string) =>
  timingSafeEqual(digest(a || ''), digest(b || ''));

/**
 * AUTH_PROVIDER=local: stands in for KeycloakService with the subset the API
 * uses. Identities come from env (the platform, system and kiosk clients, one
 * admin user) and from the apps' own clients in MongoDB; tokens are signed with
 * a key that lives in this process. Nothing is written anywhere: Keycloak's
 * administration (users, roles, realm, client resources) is not available.
 */
export class LocalKeycloakService {
  private readonly logger = new Logger('LocalAuth');

  private readonly realm: string;
  private readonly issuer: string;
  private readonly platformClient: string;
  private readonly accessTtlSec: number;
  private readonly refreshTtlSec: number;

  private readonly clients = new Map<string, LocalClient>();
  private readonly refreshTokens = new Map<string, RefreshEntry>();
  private readonly failures = new Map<
    string,
    { count: number; until: number }
  >();

  private readonly admin?: { username: string; password: string };

  constructor(
    private readonly config: ConfigService,
    private readonly connection?: Connection,
    private readonly topics?: {
      toJSON(): { resource: string; scope: string }[];
    },
  ) {
    this.realm = config.get('AUTH_KEYCLOAK_REALM');
    const trim = (v?: string) => (v || '').trim().replace(/\/+$/, '');
    const base =
      trim(config.get('AUTH_KEYCLOAK_FRONTEND_URL')) ||
      trim(config.get('AUTH_KEYCLOAK_URL'));
    // the verifier accepts this issuer by default (JwtVerifierService)
    this.issuer = `${base}/realms/${this.realm}`;
    // 12h as the Keycloak realm (KeycloakService sets accessTokenLifespan): the
    // kiosk's app token is never refreshed (toolkit posts no refresh token)
    this.accessTtlSec = +(config.get('AUTH_LOCAL_TOKEN_TTL_SEC') || 43200);
    this.refreshTtlSec = +(config.get('AUTH_LOCAL_REFRESH_TTL_SEC') || 43200);

    this.platformClient = config.get('AUTH_KEYCLOAK_CLIENT_ID') || 'platform';
    // used in-process only (the API's MQTT login, minting app tokens): the
    // token endpoint never issues platform tokens (LocalOidcController)
    const platformSecret =
      config.get('AUTH_KEYCLOAK_SECRET') ||
      randomBytes(24).toString('base64url');
    this.addClient({
      clientId: this.platformClient,
      secret: platformSecret,
      permissions: ['*'],
      system: true,
    });

    // AUTH_LOCAL_CLIENTS: `name:secret,...`; system clients if listed in
    // AUTH_KEYCLOAK_SYSTEM_CLIENT_ID
    const systemIds = (config.get('AUTH_KEYCLOAK_SYSTEM_CLIENT_ID') || '')
      .split(',')
      .map((c: string) => c.trim())
      .filter(Boolean);
    for (const entry of (config.get('AUTH_LOCAL_CLIENTS') || '').split(',')) {
      const i = entry.indexOf(':');
      if (i < 1) continue;
      const clientId = entry.slice(0, i).trim();
      const secret = entry.slice(i + 1).trim();
      if (!secret) continue;
      const system = systemIds.includes(clientId);
      this.addClient({
        clientId,
        secret,
        permissions: system ? ['*'] : [],
        system,
      });
    }

    const kioskId = config.get('AUTH_KEYCLOAK_KIOSK_CLIENT_ID');
    const kioskSecret = config.get('AUTH_KEYCLOAK_KIOSK_CLIENT_SECRET');
    if (kioskId && kioskSecret) {
      // mints app tokens through POST /platform/token, nothing else
      this.addClient({
        clientId: kioskId,
        secret: kioskSecret,
        permissions: [],
      });
    }

    const username = config.get('ADMIN_USER');
    const password = config.get('ADMIN_PASSWORD');
    if (username && password && !DEFAULT_SECRETS.includes(password)) {
      this.admin = { username, password };
    } else {
      this.logger.log(
        'No admin login: ADMIN_PASSWORD is unset or a default (admin, platform)',
      );
    }
  }

  async onModuleInit() {
    this.logger.log(
      `Local auth: realm=${this.realm} issuer=${this.issuer} clients=${[
        ...this.clients.keys(),
      ].join(',')} admin=${this.admin ? this.admin.username : 'none'}`,
    );
  }

  private addClient(client: LocalClient) {
    this.clients.set(client.clientId, client);
  }

  getRealm() {
    return this.realm;
  }

  setRealm() {
    // one realm
  }

  getPlatformClientName() {
    return this.platformClient;
  }

  getIssuer() {
    return this.issuer;
  }

  /** Keycloak's admin token: nothing to fetch */
  async getToken() {
    return null;
  }

  /**
   * A client by its Keycloak name: one from env, or an app's client from its
   * record (`<appId>-<clientId>`; `<appId>-application` is every app's login
   * client). App clients get a random secret per process when none is stored.
   */
  async getClientByName(name: string): Promise<any | null> {
    if (!name) return null;
    const known = this.clients.get(name);
    if (known) return this.toClientResponse(known);

    const appClient = await this.loadAppClient(name);
    if (!appClient) return null;
    this.addClient(appClient);
    return this.toClientResponse(appClient);
  }

  private async loadAppClient(name: string): Promise<LocalClient | null> {
    if (!this.connection) return null;
    // `<appId>-<clientId>`: either part may hold dashes, try each split
    const candidates: { appId: string; clientId: string }[] = [];
    for (let i = name.indexOf('-'); i > 0; i = name.indexOf('-', i + 1)) {
      candidates.push({ appId: name.slice(0, i), clientId: name.slice(i + 1) });
    }
    if (!candidates.length) return null;
    const apps = await this.connection
      .collection('platformapps')
      .find(
        { appId: { $in: candidates.map((c) => c.appId) } },
        { projection: { appId: 1, clients: 1 } },
      )
      .toArray();
    for (const { appId, clientId } of candidates) {
      const app = apps.find((a) => a.appId === appId);
      if (!app) continue;
      if (clientId === 'application') {
        return {
          clientId: name,
          appId,
          secret: randomBytes(24).toString('base64url'),
          permissions: ['auth.login', 'session.session'],
        };
      }
      const c = ((app.clients as any[]) || []).find(
        (c) => c?.clientId === clientId,
      );
      if (!c) continue;
      return {
        clientId: name,
        appId,
        secret: c.secret || randomBytes(24).toString('base64url'),
        permissions: c.permissions || [],
      };
    }
    return null;
  }

  private toClientResponse(c: LocalClient) {
    return {
      id: c.clientId,
      clientId: c.clientId,
      secret: c.secret,
      clientAuthenticatorType: 'client-secret',
      enabled: true,
    };
  }

  async getClientCredentials(id: string) {
    const client = this.clients.get(id) || (await this.loadAppClient(id));
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return { type: 'secret', value: client.secret };
  }

  /** registers an app module client for this process (nothing is written) */
  async saveClient(req: {
    clientId: string;
    secret?: string;
    permissions?: string[];
  }) {
    const appId = this.clients.get(req.clientId)?.appId;
    const secret =
      req.secret ||
      this.clients.get(req.clientId)?.secret ||
      randomBytes(24).toString('base64url');
    this.addClient({
      clientId: req.clientId,
      secret,
      permissions: req.permissions || [],
      appId,
    });
    return this.getClientByName(req.clientId);
  }

  async removeClient(clientId: string) {
    const c = this.clients.get(clientId);
    if (
      c &&
      !c.system &&
      c.clientId !== this.config.get('AUTH_KEYCLOAK_KIOSK_CLIENT_ID')
    ) {
      this.clients.delete(clientId);
    }
  }

  async getClientScopes() {
    return [];
  }

  async listResources() {
    return [];
  }

  /**
   * The resource scopes a token may use, in the shape of Keycloak's entitlement
   * evaluation (PlatformSettingsService reads `results[].allowedScopes`).
   */
  async allowedResources(clientId: string, userId: string) {
    const allowedScopes: { name: string }[] = [];
    for (const { resource, scope } of this.topics?.toJSON() || []) {
      if (await this.isAllowed({ clientId, userId, resource, scopes: [scope] }))
        allowedScopes.push({ name: `${resource}:${scope}` });
    }
    return {
      results: [{ status: 'PERMIT', allowedScopes }],
      entitlements: false,
      rpt: undefined,
      status: allowedScopes.length ? 'PERMIT' : 'DENY',
    };
  }

  /** used to list a user's allowed resources: admins hold everything */
  async evaluatePermission(clientId: string, payload: { userId?: string }) {
    const client = this.clients.get(clientId);
    const permit = payload?.userId === ADMIN_SUB || (client?.system ?? false);
    return { status: permit ? 'PERMIT' : 'DENY', results: [] };
  }

  /**
   * Replaces Keycloak's scope evaluation (PlatformAuthService.evaluate):
   * platform and system clients may do anything, the platform client only for
   * its own service account and the admin; an app client what its module
   * permissions say; anything else nothing.
   */
  async isAllowed(payload: {
    clientId: string;
    userId?: string;
    appId?: string;
    resource: string;
    scopes?: string[];
  }): Promise<boolean> {
    let client = this.clients.get(payload.clientId);
    if (!client) {
      await this.getClientByName(payload.clientId);
      client = this.clients.get(payload.clientId);
    }
    if (
      !client &&
      payload.appId &&
      !payload.clientId.startsWith(payload.appId)
    ) {
      const name = `${payload.appId}-${payload.clientId}`;
      await this.getClientByName(name);
      client = this.clients.get(name);
    }
    if (!client) return false;

    if (client.clientId === this.platformClient) {
      return (
        payload.userId === ADMIN_SUB ||
        payload.userId === this.serviceAccountSub(client.clientId)
      );
    }
    return matchPermissions(
      client.permissions,
      payload.resource,
      payload.scopes,
    );
  }

  private serviceAccountSub(clientId: string) {
    return `service-account-${clientId}`;
  }

  // --- tokens ---------------------------------------------------------------

  async getClientAccessToken(req: { clientId: string; clientSecret?: string }) {
    const client =
      this.clients.get(req.clientId) ||
      ((await this.getClientByName(req.clientId)) &&
        this.clients.get(req.clientId));
    if (!client || !sameSecret(client.secret, req.clientSecret || '')) {
      // the token service maps this text to 401
      throw new UnauthorizedException('Request failed with status code 401');
    }
    return this.issue(
      'client',
      this.serviceAccountSub(client.clientId),
      client,
    );
  }

  /** password grant: the admin, through the platform or an app's login client */
  async login(username: string, password: string, clientId?: string) {
    clientId = clientId || this.platformClient;
    const key = (username || '').toLowerCase();
    const failure = this.failures.get(key);
    if (
      failure &&
      failure.count >= LOGIN_MAX_FAILURES &&
      failure.until > Date.now()
    ) {
      throw new UnauthorizedException('too many attempts');
    }

    const ok =
      this.admin &&
      sameSecret(this.admin.username, username || '') &&
      sameSecret(this.admin.password, password || '');
    const client = ok ? await this.getClientByName(clientId) : null;
    if (!ok || !client) {
      const f =
        failure && failure.until > Date.now()
          ? failure
          : { count: 0, until: 0 };
      f.count++;
      f.until = Date.now() + LOGIN_LOCK_MS;
      this.failures.set(key, f);
      throw new UnauthorizedException();
    }
    this.failures.delete(key);
    return this.issue('user', ADMIN_SUB, this.clients.get(clientId));
  }

  async getClientRefreshToken(req: {
    clientId?: string;
    refreshToken: string;
  }) {
    const entry = this.refreshTokens.get(req.refreshToken || '');
    if (!entry || entry.expires < Date.now()) {
      this.refreshTokens.delete(req.refreshToken || '');
      throw new UnauthorizedException('Request failed with status code 401');
    }
    if (req.clientId && req.clientId !== entry.clientId) {
      throw new UnauthorizedException('Request failed with status code 401');
    }
    // rotated: a refresh token is used once
    this.refreshTokens.delete(req.refreshToken);
    const client = this.clients.get(entry.clientId);
    if (!client) throw new UnauthorizedException();
    if (entry.kind === 'user' && !this.admin) throw new UnauthorizedException();
    return this.issue(entry.kind, entry.subject, client);
  }

  private issue(
    kind: 'user' | 'client',
    subject: string,
    client: LocalClient,
  ): LocalTokenResponse {
    const sid = randomUUID();
    const isAdmin = kind === 'user' && subject === ADMIN_SUB;
    const roles: string[] = [];
    // as in Keycloak: the platform client's service account holds the admin role
    if (
      isAdmin ||
      (kind === 'client' && client.clientId === this.platformClient)
    ) {
      roles.push(ROLE_ADMIN);
    }
    const username =
      kind === 'user'
        ? this.admin?.username
        : `service-account-${client.clientId}`;

    const claims: Record<string, unknown> = {
      sub: subject,
      typ: 'Bearer',
      azp: client.clientId,
      sid,
      session_state: sid,
      scope: 'openid profile email',
      preferred_username: username,
      email_verified: false,
      realm_access: { roles },
      resource_access: {},
      clientId: client.clientId,
    };
    if (client.appId) claims.appId = [client.appId];

    const { kid, privateKey } = getLocalKey();
    const access_token = sign(claims, privateKey, {
      algorithm: 'RS256',
      keyid: kid,
      issuer: this.issuer,
      audience: 'account',
      expiresIn: this.accessTtlSec,
      jwtid: randomUUID(),
    });

    this.pruneRefreshTokens();
    const refresh_token = randomBytes(32).toString('base64url');
    this.refreshTokens.set(refresh_token, {
      kind,
      subject,
      clientId: client.clientId,
      expires: Date.now() + this.refreshTtlSec * 1000,
    });

    return {
      access_token,
      expires_in: this.accessTtlSec,
      refresh_expires_in: this.refreshTtlSec,
      refresh_token,
      token_type: 'Bearer',
      'not-before-policy': 0,
      session_state: sid,
      scope: 'openid profile email',
    };
  }

  private pruneRefreshTokens() {
    const now = Date.now();
    for (const [k, v] of this.refreshTokens)
      if (v.expires < now) this.refreshTokens.delete(k);
  }

  // --- users: one admin from env, nothing to manage ------------------------

  getAdminSubject() {
    return ADMIN_SUB;
  }

  getAdminUser() {
    if (!this.admin) return null;
    return {
      id: ADMIN_SUB,
      username: this.admin.username,
      enabled: true,
      realmRoles: [ROLE_ADMIN],
    };
  }

  notAvailable(): never {
    throw new ForbiddenException(
      'User management is not available with AUTH_PROVIDER=local',
    );
  }
}

/**
 * Whether `resource.scope` permissions (as app clients declare them) grant
 * `scopes` on `resource`. `*` grants everything, `resource.*` every scope of the
 * resource; a fine-grained scope `app:editor` is granted by `platform.app`.
 */
export const matchPermissions = (
  permissions: string[],
  resource: string,
  scopes: string[] = [],
) => {
  if (!resource) return false;
  if (permissions.includes('*') || permissions.includes(`${resource}.*`))
    return true;
  if (!scopes.length) return false;
  return scopes.some((scope) => {
    const base = scope.split(':')[0];
    return (
      permissions.includes(`${resource}.${scope}`) ||
      permissions.includes(`${resource}.${base}`)
    );
  });
};
