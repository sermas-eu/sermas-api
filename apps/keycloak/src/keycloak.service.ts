import GroupRepresentation from '@keycloak/keycloak-admin-client/lib/defs/groupRepresentation';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformContextDto } from 'apps/platform/src/auth/platform.auth.dto';
import { PlatformTopicsService } from 'apps/platform/src/topics/platform.topics.service';

import { KEYCLOACK_TEST_REALM, sleep } from 'libs/test';
import { isNodeEnv, jwtDecode, readJSON } from 'libs/util';

import {
  ClientCreatePolicy,
  ClientCreateResource,
  EvaluatePermissionDto,
  KeycloakClientResponseDto,
  KeycloakPolicyDto,
  KeycloakResourceDto,
} from './keycloack.authz.dto';
import {
  AssignClientRolesDto,
  AssignRealmRolesDto,
  KeycloakGroupPolicyCreateDto,
  KeycloakRealmDto,
  KeycloakRoleCreateDto,
  KeycloakRoleDto,
  KeycloakRolePolicyCreateDto,
  KeycloakUser,
  KeycloakUserRecord,
  RealmClientScopesDto,
} from './keycloak.admin.dto';
import {
  KeycloakAdminService,
  SAME_CLIENT_POLICY_NAME,
} from './keycloak.admin.service';
import {
  AddAppClientDto,
  AddClientDto,
  AddClientOptions,
  AddPlatformClientDto,
  ClientLoginDto,
  ClientPermissionDto,
  ClientRefreshTokenDto,
  KeycloakJwtTokenDto,
  SystemClientCreateDto,
} from './keycloak.dto';
import { InternalServerError } from 'openai';

export const ROLE_APP_OWNER = 'app-owner';
export const ROLE_ADMIN = 'platform-admin';

const KC_HEALTHCHECK_RETRIES = 30;
const KC_HEALTHCHECK_TIMEOUT = 10 * 1000;

const rolePolicyNamePrefix = 'has-role-';
const appGroupPolicyName = 'has-app-group';

@Injectable()
export class KeycloakService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KeycloakService.name);

  private readonly platformClientName: string;
  private realm: string;
  private token: string | null = null;
  private tokenExpires: any;

  constructor(
    private readonly config: ConfigService,
    private readonly kc: KeycloakAdminService,
    private readonly topics: PlatformTopicsService,
  ) {
    this.platformClientName = this.config.get('AUTH_KEYCLOAK_CLIENT_ID');

    this.realm = this.config.get('AUTH_KEYCLOAK_REALM');

    if (isNodeEnv('test')) {
      this.realm = KEYCLOACK_TEST_REALM;
      this.logger.warn(
        `test: KeycloakService REALM set to ${KEYCLOACK_TEST_REALM}`,
      );
    }
  }

  async onModuleInit() {
    await this.waitForHealtchecks();
  }

  async onModuleDestroy() {
    if (this.tokenExpires) clearTimeout(this.tokenExpires);
  }

  async waitForHealtchecks() {
    let retries = 0;

    while (retries < KC_HEALTHCHECK_RETRIES) {
      const ready = await this.kc.healthcheck();
      if (ready) return;
      retries++;
      this.logger.log(
        `Waiting for Keycloak to be ready, it may take a while. Be patient. (${retries}/${KC_HEALTHCHECK_RETRIES})`,
      );
      await sleep(KC_HEALTHCHECK_TIMEOUT);
    }

    this.logger.error(`Failed to reach Keycloak. Exiting..`);
    process.exit(0);
  }

  public setRealm(realm: string) {
    this.realm = realm;
  }

  public getRealm() {
    return this.realm;
  }

  public getPlatformClientName() {
    return this.platformClientName;
  }

  async importSystemClientsFromFile(filepath: string) {
    const systemClients = await readJSON<SystemClientCreateDto[]>(filepath);
    await this.importSystemClients(systemClients);
  }

  async importSystemClients(systemClients: SystemClientCreateDto[]) {
    for (const sc of systemClients) {
      await this.saveSystemClient(sc);
    }
  }

  async removeClientByName(clientId: string) {
    const clients = await this.searchClientsByName(clientId);
    for (const client of clients) {
      await this.removeClient(client.clientId);
    }
  }

  async removeUserByName(username: string) {
    const users = await this.getUsers(username);
    await Promise.all(users.map((user) => this.removeUser(user.username)));
  }

  async saveSystemClient(req: SystemClientCreateDto) {
    await this.getToken();

    const clients = await this.searchClientsByName(req.clientId);
    let secret: string;
    if (clients.length) {
      const [client] = clients;
      secret = client.secret;
      await this.removeClient(client.clientId);
    }

    this.logger.log(`creating system client ${req.clientId}`);
    return await this.saveClient({
      clientId: req.clientId,
      permissions: req.permissions,
      options: {
        allowWildcard: true,
      },
      secret,
      authorizationEnabled: true,
    });
  }

  async getClientAccessToken(req: ClientLoginDto) {
    await this.getToken();

    const payload = {
      realm: req.realm || this.config.get('AUTH_KEYCLOAK_REALM'),
      username: req.clientId,
      password: req.clientSecret,
      grantType: 'client_credentials',
      clientId: req.clientId,
      audience: req.audience,
    };
    return await this.kc.getToken(payload, true);
  }

  parseJWT(token: string): KeycloakJwtTokenDto {
    const data = jwtDecode<KeycloakJwtTokenDto>(token);
    return data;
  }

  getClientRefreshToken(req: ClientRefreshTokenDto) {
    return this.kc.getRefreshToken(
      {
        realm: this.config.get('AUTH_KEYCLOAK_REALM'),
        clientId: req.clientId,
        refreshToken: req.refreshToken,
        accessToken: req.accessToken,
      },
      true,
    );
  }

  async getToken(force = false) {
    if (force) {
      this.token = null;
      if (this.tokenExpires) clearTimeout(this.tokenExpires);
    }

    if (this.token) return this.token;

    this.logger.verbose(`refreshing keycloack admin token`);
    try {
      const token = await this.kc.getToken({
        username: this.config.get('ADMIN_SERVICE_ACCOUNT_USERNAME'),
        password: this.config.get('ADMIN_SERVICE_ACCOUNT_PASSWORD'),
      });

      this.token = token.access_token;

      if (this.tokenExpires) clearTimeout(this.tokenExpires);
      this.tokenExpires = setTimeout(
        () => {
          this.logger.verbose(`Keycloack admin token expired`);
          this.token = null;
        },
        (token.expires_in - Math.round(token.expires_in * 0.3)) * 1000,
      );
      this.logger.verbose(`token expires in ${token.expires_in / 60}min`);
    } catch (e) {
      this.logger.debug(`Failed to get keycloak token: ${e.message}`);
      this.logger.verbose(e.stack);
      this.token = null;
      throw new InternalServerErrorException(e);
    }
  }

  async getClientByName(
    clientId: string,
  ): Promise<KeycloakClientResponseDto | null> {
    await this.getToken();

    const clients = await this.kc.clientsList({
      token: this.token,
      realm: this.realm,
      clientId,
    });

    const client = !clients || !clients.length ? null : clients[0];
    if (!client) return null;
    return client.clientId === clientId ? client : null;
  }

  async searchClientsByName(
    clientId: string,
    exactMatch = false,
  ): Promise<KeycloakClientResponseDto[]> {
    await this.getToken();

    const clients = await this.kc.clientsList({
      token: this.token,
      realm: this.realm,
      clientId,
      exactMatch,
    });

    return clients || [];
  }

  async removeClient(clientId: string): Promise<void> {
    await this.getToken();

    const client = await this.getClientByName(clientId);
    if (!client) return;

    await this.kc.deleteClient({
      realm: this.realm,
      token: this.token,
      name: client.id,
    });
    this.logger.verbose(`clientId=${clientId} removed`);
  }

  extractResources(
    permissions: string[],
    options: AddClientOptions = {},
  ): ClientCreateResource[] {
    permissions = permissions || [];

    const topicsList = this.topics.toJSON();
    const topics = this.topics.toTree(topicsList);

    if (!options.allowWildcard) {
      permissions = permissions.filter((p) => p !== '*');
    }

    // if * add all the resource.scopes
    if (permissions.includes('*')) {
      permissions = topicsList.map(
        ({ resource, scope }) => `${resource}.${scope}`,
      );
    }

    const resources: ClientCreateResource[] = Object.values(
      permissions
        .map((p) => p.split('.'))
        .map(([resource, scope]) => ({ resource, scope }))
        .filter((p) => {
          // remove wildcards
          if (
            !options.allowScopeWildcard &&
            !options.allowWildcard &&
            p.scope === '*'
          ) {
            return false;
          }

          // pass to next
          if (p.scope === '*') return true;

          // remove resource/scopes that do not exists
          if (!topics[p.resource]) return false;

          let scope = p.scope;
          if (options.allowFineGrained === true && p.scope.indexOf(':') > -1) {
            const parts = p.scope.split(':');
            if (parts.length > 2) {
              // remove last, which is the fine grained scope in the format resource:scope:operation
              // eg. platform:app:editor
              parts.pop();
              scope = parts.join(':');
            }
          }

          if (!topics[p.resource].includes(scope)) return false;

          return true;
        })
        .reduce((list, p) => {
          // if persmission is in the format e.g. `dialogue.*` add all possible scopes for the resource
          let resources = [p];
          if (p.scope === '*' && topics[p.resource]) {
            resources = topics[p.resource].map((scope) => ({
              resource: p.resource,
              scope,
            }));
          }

          return [...list, ...resources];
        }, [])
        .reduce(
          (obj, item) => {
            obj[item.resource] = obj[item.resource] || {
              name: item.resource,
              scopes: [item.scope],
            };

            if (!obj[item.resource].scopes.includes(item.scope))
              obj[item.resource].scopes.push(item.scope);

            return obj;
          },
          {} as Record<string, ClientCreateResource>,
        ),
    );

    return resources;
  }

  async createClientRole(clientId: string, data: KeycloakRoleCreateDto) {
    const roles = await this.listClientRoles(clientId);

    const exists = roles.filter((r) => r.name === data.name);
    if (exists.length) return;

    await this.kc.addClientRole(this.token, this.realm, clientId, data);
    this.logger.verbose(
      `Created client role ${data.name} for clientId=${clientId}`,
    );
  }

  async listClientRoles(clientId: string) {
    return await this.kc.listClientRoles(this.token, this.realm, clientId);
  }

  async ensureRealmRoles(roles: string[]) {
    for (const role of roles) {
      await this.createRealmRole(role);
    }

    const realmRoles = (await this.listRealmRoles()).filter(
      (r) => !r.clientRole && roles.includes(r.name),
    );

    return realmRoles;
  }

  async ensureClientRoles(clientId: string, roles: string[]) {
    for (const role of roles) {
      await this.createClientRole(clientId, { name: role });
    }

    const clientRoles = (await this.listClientRoles(clientId)).filter(
      (r) => r.clientRole && roles.includes(r.name),
    );

    return clientRoles;
  }

  async saveClientRolePolicy(clientId: string, roles: KeycloakRoleDto[]) {
    // create policies for all roles

    const policies = await this.getClientPolicies(clientId);

    for (const role of roles) {
      const policyName = `${rolePolicyNamePrefix}${role.name}`;

      const filtered = policies.filter((p) => p.name === policyName);
      if (filtered.length) {
        this.logger.log(`Policy ${policyName} exists. Skip creation`);
        continue;
      }

      const rolePolicy: KeycloakRolePolicyCreateDto = {
        name: policyName,
        logic: 'POSITIVE',
        roles: [{ id: role.id, required: true }],
      };
      await this.kc.addClientRolePolicy({
        token: this.token,
        realm: this.realm,
        clientId,
        data: rolePolicy,
      });
    }
  }

  async saveClientGroupPolicy(clientId: string, group: GroupRepresentation) {
    const policies = await this.getClientPolicies(clientId);

    const policyName = appGroupPolicyName;

    const filtered = policies.filter((p) => p.name === policyName);
    if (filtered.length) {
      this.logger.log(`Policy ${policyName} exists. Skip creation`);
      return;
    }

    const groupPolicy: KeycloakGroupPolicyCreateDto = {
      name: policyName,
      logic: 'POSITIVE',
      groupsClaim: '',
      groups: [{ id: group.id, extendChildren: false }],
    };

    await this.kc.addClientGroupPolicy({
      token: this.token,
      realm: this.realm,
      clientId,
      data: groupPolicy,
    });
  }

  async loadPolicies(clientId: string, policyNames: string[]) {
    const clientPolicies = await this.kc.listPolicies({
      clientId,
      realm: this.realm,
      token: this.token,
    });

    const policies = [
      ...clientPolicies.filter((p) => policyNames.includes(p.name)),
    ];

    if (!policies || policies.length !== policyNames.length)
      throw new NotFoundException(
        `Some policies not found. Policies found=${policies
          .map((p) => p.name)
          .join(',')} expected=${policyNames.join(',')}`,
      );

    return policies;
  }

  async saveResourcePermission(
    clientId: string,
    policies: KeycloakPolicyDto[],
    policyName = 'matches-roles',
  ) {
    // fetch resources
    const resources = await this.kc.listClientResources({
      realm: this.realm,
      token: this.token,
      clientId,
    });

    const permissions = await this.kc.listClientPermissions({
      realm: this.realm,
      token: this.token,
      clientId,
    });

    const payload = {
      decisionStrategy: 'CONSENSUS',
      description: '',
      name: policyName,
      resources: resources.map((r) => r._id),
      policies: policies.map((p) => p.id),
    };

    const filtered = permissions.filter((p) => p.name === policyName);
    if (filtered.length) {
      await this.kc.updateResourcePermission({
        policyId: filtered[0].id,
        clientId,
        realm: this.realm,
        token: this.token,
        data: payload,
      });
      return;
    }

    await this.kc.createResourcePermission({
      clientId,
      realm: this.realm,
      token: this.token,
      data: payload,
    });
  }

  async listGroups(search?: string, first?: number, max?: number) {
    await this.getToken();
    const groups = await this.kc.listGroups({
      realm: this.realm,
      token: this.token,
      data: {
        search,
        first,
        max,
      },
    });
    return groups;
  }

  async getGroup(name: string) {
    const groups = await this.listGroups();
    const filtered = groups.filter((g) => g.name === name);
    return filtered.length ? filtered[0] : null;
  }

  async ensureGroup(name: string) {
    const group = await this.getGroup(name);
    if (group) return group;

    await this.kc.createGroup({
      name,
      realm: this.realm,
      token: this.token,
    });

    return await this.getGroup(name);
  }

  // app client (eg. <appId>-application) wih a realm role (admin) for platform management and a client role (owner) to assign to users to manage their own app
  async saveAppClient(req: AddAppClientDto) {
    const client = await this.saveClient(req);

    // 1. create client roles, policies and permission
    // create client roles
    const clientRoles = await this.ensureClientRoles(
      client.id,
      req.clientRoles,
    );
    const realmRoles = await this.ensureRealmRoles(req.realmRoles);
    // save role policy
    const allRoles = [...clientRoles, ...realmRoles];
    await this.saveClientRolePolicy(client.id, allRoles);
    // load policies
    const rolePolicyNames = [
      ...allRoles.map((r) => `${rolePolicyNamePrefix}${r.name}`),
      SAME_CLIENT_POLICY_NAME,
    ];
    const rolePolicies = await this.loadPolicies(client.id, rolePolicyNames);
    // create resource based permission for those policies
    await this.saveResourcePermission(client.id, rolePolicies);

    // 2. create application group, policies and permission
    // add application group
    const group = await this.ensureGroup(req.clientId);
    // save group policy
    await this.saveClientGroupPolicy(client.id, group);
    // load policies
    const groupPolicyNames = [appGroupPolicyName, SAME_CLIENT_POLICY_NAME];
    const groupPolicies = await this.loadPolicies(client.id, groupPolicyNames);
    // save group based permissions

    // await this.saveResourcePermission(
    //   client.id,
    //   groupPolicies,
    //   'match-app-group',
    // );

    const resources = this.extractResources(req.permissions, {
      allowFineGrained: true,
      allowWildcard: true,
      allowScopeWildcard: true,
    });

    await this.getToken();
    await this.kc.createClientPermissions({
      realm: this.realm,
      token: this.token,
      policies: groupPolicies,
      clientId: client.id,
      resources,
      forceOverwrite: true,
    });

    return await this.getClientByName(client.clientId);
  }

  async ensureResources(clientId: string, resources: ClientCreateResource[]) {
    const existingResources = await this.kc.listClientResources({
      realm: this.realm,
      token: this.token,
      clientId,
    });

    const toList = (
      list: (ClientCreateResource | KeycloakResourceDto)[],
    ): Record<string, string[]> => {
      return list.reduce(
        (obj, item) => ({
          ...obj,
          [item.name]: Array.from(
            new Set([
              ...(obj[item.name] || []),
              ...(item.scopes || []).map((s) =>
                typeof s === 'string' ? s : s.name,
              ),
            ]),
          ),
        }),
        {},
      );
    };

    const newRes = toList(resources);
    const savedRes = toList(existingResources);
    const updatedResNames = [];

    for (const res in newRes) {
      const found = savedRes[res];
      if (!found) {
        await this.kc.createClientResource({
          realm: this.realm,
          token: this.token,
          clientId,
          resource: {
            name: res,
            scopes: newRes[res],
          },
        });
        updatedResNames.push(res);
        continue;
      }

      await this.kc.updateClientResource({
        realm: this.realm,
        token: this.token,
        clientId,
        resource: {
          name: res,
          scopes: Array.from(new Set([...found, ...newRes[res]])),
        },
      });
      updatedResNames.push(res);
    }

    for (const res in savedRes) {
      if (updatedResNames.includes(res)) continue;
      // this.logger.verbose(`Resource ${res} not matching`);
    }
  }

  // save a platform client to allow admins full control and normal users to operate over a selection of APIs to create apps
  async savePlatformClient(req: AddPlatformClientDto) {
    // set defaults
    const adminRole = req.adminRole || ROLE_ADMIN;
    const permissions =
      req.permissions && req.permissions.length
        ? req.permissions
        : ['platform.app:editor', 'auth.login'];
    // force recreation by default
    req.removeIfExists =
      req.removeIfExists === undefined ? true : req.removeIfExists;

    const client = await this.saveClient(req);

    const realmRoles = await this.ensureRealmRoles([adminRole]);
    await this.saveClientRolePolicy(client.id, realmRoles);

    // update policies with owner role
    const policyNames = [
      ...realmRoles.map((r) => `${rolePolicyNamePrefix}${r.name}`),
      SAME_CLIENT_POLICY_NAME,
    ];
    const policies = await this.loadPolicies(client.id, policyNames);

    const existingPermissions = await this.getClientPermissions(client.id);

    const hasAdminRolePermissionName = 'has-admin-role';
    if (
      !existingPermissions.filter((p) => p.name === hasAdminRolePermissionName)
        .length
    ) {
      // create resource based permission for admins
      await this.saveResourcePermission(
        client.id,
        policies,
        hasAdminRolePermissionName,
      );
    }

    const resources = this.extractResources(permissions, {
      allowScopeWildcard: true,
      allowWildcard: true,
      allowFineGrained: true,
    });
    await this.ensureResources(client.id, resources);

    await this.getToken();
    await this.kc.createClientPermissions({
      realm: this.realm,
      token: this.token,

      policies,
      clientId: client.id,
      resources,
    });

    return client;
  }

  async getClientResources(clientId: string) {
    await this.getToken();
    return await this.kc.listClientResources({
      clientId,
      realm: this.realm,
      token: this.token,
    });
  }

  async getClientPolicies(clientId: string) {
    await this.getToken();
    return await this.kc.listClientPolicies({
      clientId,
      realm: this.realm,
      token: this.token,
    });
  }

  async getClientScopes(clientId: string) {
    await this.getToken();
    return await this.kc.listClientScopes({
      clientId,
      realm: this.realm,
      token: this.token,
    });
  }

  getClientPermissions(clientId: string) {
    return this.kc.listClientPermissions({
      clientId,
      realm: this.realm,
      token: this.token,
    });
  }

  async saveClient(req: AddClientDto) {
    await this.getToken();

    if (req.removeIfExists) {
      this.logger.verbose(`Removing client ${req.clientId}`);
      await this.removeClient(req.clientId);
    }

    let client = await this.getClientByName(req.clientId);
    if (!client) {
      this.logger.verbose(`Client not found, creating client ${req.clientId}`);
      const kcClient = await this.kc.createClient({
        token: this.token,
        realm: this.realm,
        name: req.clientId,
        description: req.description,
        secret: req.secret,
        authorizationEnabled: req.authorizationEnabled,
        // resources: resourcesMap.resources,
        // scopes: resourcesMap.scopes,
      });

      // reload reference
      client = await this.getClientByName(kcClient.clientId);
    } else {
      this.logger.verbose(
        `Client ${req.clientId} exists, updating scope-based permissions`,
      );
      await this.syncClientResources(client.clientId);
    }

    // allow wildcards by default
    const options = req.options || {};
    if (options.allowScopeWildcard === undefined)
      options.allowScopeWildcard = true;
    if (options.allowWildcard === undefined) options.allowWildcard = true;

    const resources = this.extractResources(req.permissions, options);

    const policies: ClientCreatePolicy[] = await this.getClientPolicies(
      client.id,
    );

    this.logger.verbose(
      `Saving resource-based permissions for client ${req.clientId}`,
    );

    await this.getToken();
    await this.kc.createClientPermissions({
      realm: this.realm,
      token: this.token,

      policies,
      clientId: client.id,
      resources,
    });

    if (req.attributes && req.attributes.length) {
      this.logger.verbose(`Saving attributes for client ${req.clientId}`);
      await this.ensureClientAttributes(client.clientId, req.attributes);
    }

    this.logger.verbose(`Saved client ${req.clientId}`);
    return client;
  }

  // sync client resources and scopes to the current topics list
  async syncClientResources(clientId: string) {
    const client = await this.getClientByName(clientId);
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);

    const clientResources = await this.getClientResources(client.id);
    // const policies = await this.getClientPolicies(client.id);

    const topics = this.topics.toTree(undefined, true);
    const resourcesTree: Record<string, string[]> = clientResources.reduce(
      (o, r) => ({
        ...o,
        [r.name]: [
          ...(o[r.name] || []),
          ...(r.scopes || []).map((s) => s.name),
        ],
      }),
      {},
    );

    const state: Record<string, Record<string, string[]>> = {
      added: {},
      notMatching: {},
    };

    for (const resource in topics) {
      const scopes = topics[resource];

      if (!resourcesTree[resource]) {
        state.added[resource] = scopes;
        continue;
      }

      scopes.forEach((scope) => {
        const found = resourcesTree[resource].includes(scope);
        if (!found) {
          state.added[resource] = state.added[resource] || [];
          state.added[resource].push(scope);
        }
      });
    }

    for (const resource in resourcesTree) {
      const scopes = resourcesTree[resource];

      if (!topics[resource]) {
        state.notMatching[resource] = scopes;
        continue;
      }

      scopes.forEach((scope) => {
        if (!topics[resource].includes(scope)) {
          state.notMatching[resource] = state.notMatching[resource] || [];
          state.notMatching[resource].push(scope);
        }
      });
    }

    const newResources: ClientCreateResource[] = Object.keys(
      state.added,
    ).reduce(
      (arr, resource) => [
        ...arr,
        {
          name: resource,
          scopes: state.added[resource],
        },
      ],
      [],
    );

    // console.log(state, newResources);
    if (newResources.length) {
      await this.ensureResources(client.id, newResources);
    }

    const clientScopes = await this.kc.listClientScopes({
      clientId: client.id,
      realm: this.realm,
      token: this.token,
    });

    for (const resource in state.notMatching) {
      const scopes = state.notMatching[resource];

      const filtered = clientResources.filter((r) => r.name === resource);
      if (!filtered) {
        this.logger.warn(`Resource ${resource} id not found, skip deletion`);
        continue;
      }

      const resourceId = filtered[0]._id;

      if (!scopes.length) {
        this.logger.verbose(
          `Removing resource=${resource} resourceId=${resourceId}`,
        );
        await this.deleteClientResource(client.id, resourceId);
        continue;
      }

      // remove scopes from resource
      const scopesDiff = resourcesTree[resource].filter(
        (s) => !scopes.includes(s),
      );
      this.logger.verbose(
        `Detaching scopes=${scopesDiff.join(
          ',',
        )} from resource=${resource} client=${clientId}`,
      );

      await this.kc.updateClientResource({
        token: this.token,
        realm: this.realm,
        clientId: client.id,
        resource: {
          name: resource,
          scopes: scopesDiff,
        },
      });

      await Promise.all(
        scopes.map(async (scope) => {
          this.logger.verbose(`Removing resource=${resource} scope=${scope}`);
          const filtered = clientScopes.filter((s) => s.name === scope);
          if (!filtered.length) {
            this.logger.verbose(`scope=${scope} id not found, skip deletion`);
            return;
          }
          await this.deleteClientScope(client.id, filtered[0].id);
        }),
      );
    }
  }

  async deleteClientResource(clientId: string, resourceId: string) {
    await this.kc.deleteClientResource({
      realm: this.realm,
      token: this.token,
      clientId,
      resourceId,
    });
  }

  async deleteClientScope(clientId: string, scopeId: string) {
    await this.kc.deleteClientScope({
      realm: this.realm,
      token: this.token,
      clientId,
      scopeId,
    });
  }

  async ensureRealmClientScopes(scopes: string[]) {
    const clientScopes = await this.kc.listRealmClientScopes({
      token: this.token,
      realm: this.realm,
    });

    const scopesList: RealmClientScopesDto[] = [];
    for (const scopeName of scopes) {
      const filtered = clientScopes.filter((s) => s.name === scopeName);
      if (filtered.length) {
        this.logger.verbose(`Skip realm client scope ${scopeName}`);
        scopesList.push(filtered[0]);
        continue;
      }

      // create attributes scope in realm
      const clientScope = await this.kc.createRealmClientScope({
        token: this.token,
        realm: this.realm,
        clientScope: {
          name: scopeName,
          description: '',
          attributes: {
            'consent.screen.text': '',
            'display.on.consent.screen': 'false',
            'include.in.token.scope': 'true',
            'gui.order': '',
          },
          type: 'default',
          protocol: 'openid-connect',
        },
      });
      scopesList.push(clientScope);

      // create attributes based mapper
      await this.kc.createProtocolMapper({
        token: this.token,
        realm: this.realm,
        clientScopeId: clientScope.id,
        protocolMapper: {
          protocol: 'openid-connect',
          protocolMapper: 'oidc-usermodel-attribute-mapper',
          name: scopeName,
          config: {
            'user.attribute': scopeName,
            'claim.name': scopeName,
            'jsonType.label': '',
            'id.token.claim': false,
            'access.token.claim': 'true',
            'userinfo.token.claim': 'true',
            multivalued: true,
            'aggregate.attrs': false,
          },
        },
      });
    }

    return scopesList;
  }

  async ensureClientAttributes(clientId: string, attributes: string[]) {
    const client = await this.getClientByName(clientId);

    const attrScopes = await this.ensureRealmClientScopes(attributes);

    const allClientClientScopes = await this.kc.listAllClientClientScopes({
      token: this.token,
      realm: this.realm,
      clientId: client.id,
    });

    const newClientClientScopes = attrScopes.filter(
      (s) => !allClientClientScopes.filter((cs) => cs.id === s.id).length,
    );

    for (const scope of newClientClientScopes) {
      await this.kc.assignClientClientScope({
        token: this.token,
        realm: this.realm,
        clientId: client.id,
        type: 'default',
        scopeId: scope.id,
      });
      this.logger.verbose(
        `Assigned scope ${scope.name} to clientId=${client.id}`,
      );
    }
  }

  async getPermissions(
    payload: PlatformContextDto,
  ): Promise<ClientPermissionDto[]> {
    return this.kc.getPermissions({
      realm: this.realm,
      ...payload,
    });
  }

  assignClientRoles(data: AssignClientRolesDto) {
    return this.kc.assignClientRoles({
      ...data,
      realm: this.realm,
      token: this.token,
    });
  }

  assignRealmRoles(data: AssignRealmRolesDto) {
    return this.kc.assignRealmRoles({
      ...data,
      realm: this.realm,
      token: this.token,
    });
  }

  async createRealmRole(name: string) {
    await this.getToken();
    const roles = await this.listRealmRoles();
    const exists = roles.filter((r) => r.name === name);
    if (exists.length) return;

    await this.kc.addRealmRole(this.token, this.realm, {
      name,
    });
  }

  async listRealmRoles() {
    await this.getToken();
    return await this.kc.listRealmRoles(this.token, this.realm);
  }

  async deleteRealmRole(name: string) {
    await this.getToken();

    const roles = await this.listRealmRoles();
    const exists = roles.filter((r) => r.name === name);
    if (!exists.length) return;

    const role = exists[0];

    await this.kc.deleteRealmRole(this.token, this.realm, role.id);
  }

  async saveUser(data: KeycloakUser) {
    await this.getToken();
    return await this.kc.saveUser(this.token, this.realm, data);
  }

  async updateUser(data: KeycloakUserRecord) {
    await this.getToken();
    return await this.kc.updateUser({
      token: this.token,
      realm: this.realm,
      user: data,
    });
  }

  async getUsers(username: string, exact = false) {
    await this.getToken();
    const users = await this.kc.listUsers(this.token, this.realm, {
      username,
      exact,
    });
    return users;
  }

  async getUserByUsername(username: string) {
    const users = await this.getUsers(username, true);
    return !users.length ? null : users[0];
  }

  async getUserById(id: string) {
    await this.getToken();
    try {
      return await this.kc.getUser(this.token, this.realm, id);
    } catch {
      return null;
    }
  }

  async removeUser(username: string) {
    await this.getToken();
    this.logger.log(`Removing user ${username}`);
    await this.kc.deleteUserByUsername(this.token, this.realm, username);
  }

  async getClientCredentials(clientId: string) {
    await this.getToken();
    return await this.kc.getClientSecret({
      realm: this.realm,
      token: this.token,
      clientId,
    });
  }

  async evaluatePermission(clientId: string, payload: EvaluatePermissionDto) {
    await this.getToken();

    const client = await this.getClientByName(clientId);
    if (!client) throw new NotFoundException(`Client not found`);

    return await this.kc.evaluatePermission({
      realm: this.realm,
      token: this.token,
      clientId: client.id,
      payload,
    });
  }

  async createRealm(realm: string) {
    await this.getToken();
    return await this.kc.createRealm({
      token: this.token,
      realm,
      enabled: true,
    });
  }

  async listRealms(realm?: string) {
    await this.getToken();
    return await this.kc.listRealms({
      token: this.token,
      realm,
    });
  }

  async deleteRealmByName(realm?: string) {
    await this.getToken();
    await this.kc.deleteRealmByName({
      token: this.token,
      realm,
    });
  }

  async deleteGroupByName(group?: string) {
    await this.getToken();
    await this.kc.deleteGroupByName({
      token: this.token,
      realm: this.realm,
      name: group,
    });
  }

  async deleteRealm(realm?: string) {
    await this.getToken();
    await this.kc.deleteRealm({
      token: this.token,
      realm,
    });
  }

  async ensureRealm(realm: string) {
    await this.getToken();

    const realms = (await this.listRealms(realm)).filter(
      (r) => r.realm === realm,
    );

    let realmObj: KeycloakRealmDto;
    if (!realms.length) {
      realmObj = await this.createRealm(realm);
    } else {
      realmObj = realms[0];
    }

    // 12h
    const ttl = 60 * 60 * 12;

    await this.kc.updateRealmSettings({
      realm,
      token: this.token,
      config: {
        accessTokenLifespan: ttl,
        ssoSessionIdleTimeout: ttl,
        ssoSessionMaxLifespan: ttl,
        clientSessionIdleTimeout: ttl,
        clientSessionMaxLifespan: ttl,
      },
    });

    return realmObj;
  }

  async resetUserPassword(userId: string, password: string, temporary = false) {
    await this.getToken();
    await this.kc.resetUserPassword({
      realm: this.realm,
      token: this.token,
      userId,
      password,
      temporary,
    });
  }

  async login(username: string, password: string, clientId?: string) {
    clientId = clientId || this.platformClientName;

    const client = await this.getClientByName(clientId);
    const credentials = await this.getClientCredentials(client.id);
    const clientSecret = credentials.value;

    await this.getToken();

    return await this.kc.login({
      realm: this.realm,
      token: this.token,
      username,
      password,
      clientId,
      clientSecret,
    });
  }

  async assignUserApps(userId: string, appId: string | string[], merge = true) {
    const user = await this.getUserById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    user.attributes = user.attributes || {};

    appId = appId || [];
    const appsId = appId instanceof Array ? appId : [appId];

    const currentAppId = user.attributes['appId'] || [];
    const currentAppsId =
      currentAppId instanceof Array ? currentAppId : [currentAppId];

    // merge or update appId list
    user.attributes['appId'] = merge
      ? Array.from(new Set([...appsId, ...currentAppsId]))
      : appsId;

    await this.updateUser(user);

    return user.attributes['appId'];
  }

  async getServiceAccountsApps(clientId: string) {
    const serviceAccount = await this.getUserByUsername(
      `service-account-${clientId}`,
    );
    if (!serviceAccount)
      throw new NotFoundException(`Service account for ${clientId} not found`);

    return this.extractAttrbutesApps(serviceAccount.attributes);
  }

  async getUserApps(userId: string) {
    const user = await this.getUserById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return this.extractAttrbutesApps(user.attributes);
  }

  private extractAttrbutesApps(attributes?: Record<string, string | string[]>) {
    attributes = attributes || {};
    const apps: string[] =
      attributes['appId'] instanceof Array
        ? attributes['appId']
        : [attributes['appId']];
    return apps || [];
  }

  async listResources(clientId: string) {
    await this.getToken();
    return await this.kc.listClientResources({
      clientId,
      realm: this.realm,
      token: this.token,
    });
  }
}
