import type GroupRepresentation from '@keycloak/keycloak-admin-client/lib/defs/groupRepresentation';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformTopicsService } from 'apps/platform/src/topics/platform.topics.service';
import axios, { AxiosError, AxiosInstance, isAxiosError } from 'axios';
import * as https from 'https';
import { isNodeEnv, uuidv4 } from 'libs/util';
import { clientDefaultConfiguration } from './config/defaultConf';
import {
  ClientCreateResource,
  ClientCreateResourceReq,
  ClientCreateScope,
  ClientCreateScopeReq,
  ClientCreatedDto,
  ClientPermissionPolicyDto,
  ClientPermissionRequestDto,
  ClientPermissionResourceDto,
  ClientPermissionScopeDto,
  ClientPolicyRecordDto,
  ClientPolicyRemoveDto,
  ClientPolicySearchDto,
  CreateClientPermissionDto,
  CreateClientPermissionsDto,
  CreateClientResourcesDto,
  CreateClientScopesDto,
  CreateResourcePermissionRequestDto,
  EvaluatePermissionReqDto,
  EvaluationResultResponseDto,
  KeycloakClientResponseDto,
  KeycloakPermissionCreateDto,
  KeycloakPolicyDto,
  KeycloakResourceDto,
  KeycloakScopeDto,
  ListPermissionRequestDto,
  ListPoliciesRequestDto,
  UpdatePermissionRequestDto,
  UpdateResourcePermissionRequestDto,
} from './keycloack.authz.dto';
import {
  AssignClientRolesRequestDto,
  AssignRealmRolesRequestDto,
  ClientClientScopesDto,
  ClientCredentialsDto,
  CreateProtocolMapperDto,
  CreateRealmClientScopeDto,
  GetClientSecretRequestDto,
  GetPermissionPoliciesRequestDto,
  GetPermissionResourcesRequestDto,
  GetPermissionScopesRequestDto,
  KeycloakClientsCreationDto,
  KeycloakClientsListDto,
  KeycloakClientsUsersUpdateDto,
  KeycloakCreateRealmRequestDto,
  KeycloakGetRefreshTokenDto,
  KeycloakGroupPolicyCreateDto,
  KeycloakGroupsCreationDto,
  KeycloakLoginDto,
  KeycloakPermissionDto,
  KeycloakRealmDto,
  KeycloakRealmExportDto,
  KeycloakRealmRequestDto,
  KeycloakRoleCreateDto,
  KeycloakRoleDto,
  KeycloakRolePolicyCreateRequestDto,
  KeycloakRolesListDto,
  KeycloakTokenDto,
  KeycloakUser,
  KeycloakUserRecord,
  KeycloakUsersListDto,
  ListClientPoliciesRequestDto,
  ListClientResourcesRequestDto,
  ListClientScopesRequestDto,
  RealmClientScopesDto,
} from './keycloak.admin.dto';
import { ClientPermissionDto } from './keycloak.dto';

type KcApiBaseParams = {
  realm: string;
  token: string;
};

interface KcApiParam<T> extends KcApiBaseParams {
  data?: T;
}

export const SAME_CLIENT_POLICY_NAME = 'same-client';

@Injectable()
export class KeycloakAdminService implements OnModuleInit {
  private readonly logger = new Logger(KeycloakAdminService.name);

  private client: AxiosInstance;

  private readonly keycloakPublicUrl: string;
  private readonly keycloakUrl: string;
  private readonly keycloakAdminUrl: string;

  constructor(
    private readonly config: ConfigService,
    // @InjectModel(MongoKeycloakConfig.name)
    // private readonly keycloakModel: Model<KeycloakConfigDocument>,
    private readonly platformTopics: PlatformTopicsService,
  ) {
    this.keycloakPublicUrl = this.config.get<string>('AUTH_KEYCLOAK_URL');
    if (!this.keycloakPublicUrl)
      throw new InternalServerErrorException(`Missing env AUTH_KEYCLOAK_URL`);

    this.keycloakUrl =
      this.config.get<string>('LOCAL_KEYCLOAK_URL') || this.keycloakPublicUrl;

    this.keycloakAdminUrl =
      this.config.get<string>('AUTH_KEYCLOAK_ADMIN_URL') || this.keycloakUrl;

    this.client = axios.create({
      httpsAgent: new https.Agent({
        // ignore self-signed certs
        rejectUnauthorized: isNodeEnv('development') ? false : true,
      }),
    });
  }

  async onModuleInit() {
    //
  }
  async onModuleDestroy() {
    //
  }

  getKeycloakPublicUrl() {
    return this.keycloakPublicUrl;
  }

  printErrorStack(fn: string, e: any, throwError = true) {
    let errMsg = `${fn} error: `;

    if (isAxiosError(e)) {
      const err = e as AxiosError;
      errMsg += `request failed status=${err.status} code=${
        err.code
      } response=${
        err.response?.data ? JSON.stringify(err.response?.data) : ''
      }`;
    } else {
      errMsg += e.stack;
    }

    this.logger.error(errMsg);

    if (throwError) throw new InternalServerErrorException(errMsg);
  }

  // async getConfig(realm: string): Promise<KeycloakConfigDto> {
  //   return await this.keycloakModel.findOne({ realm });
  // }

  // async saveConfig(config: KeycloakConfigDto): Promise<void> {
  //   await this.keycloakModel.updateOne({ realm: config.realm }, config, {
  //     upsert: true,
  //   });
  //   await this.applyConfig(config.realm);
  // }

  // async applyConfig(realm: string): Promise<void> {
  //   const token = await this.getKeycloakAdminToken({
  //     username: process.env.ADMIN_SERVICE_ACCOUNT_USERNAME,
  //     password: process.env.ADMIN_SERVICE_ACCOUNT_PASSWORD,
  //   });
  //   const config = await this.getConfig(realm);
  //   if (!config) {
  //     throw new NotFoundException(`Config not found for realm ${realm}`);
  //   }
  //   await this.resetConfig(token, config);
  //   this.logger.log('Creating resources');
  //   // add clients
  //   await Promise.all(
  //     config.clients.map(async (c: KeycloakClient) => {
  //       await this.createClient({
  //         token: token,
  //         realm: config.realm,
  //         name: c.clientId,
  //         public: c.public,
  //         rootUrl: c.rootUrl,
  //         redirectUrl: c.redirectUrl,
  //         secret: c.secret,
  //         resources: c.resources,
  //         scopes: c.scopes,
  //       });
  //     }),
  //   );
  //   // add roles
  //   await Promise.all(
  //     config.roles.map(
  //       async (r: KeycloakRoleCreateDto) =>
  //         await this.addRealmRole(token, config.realm, r),
  //     ),
  //   );
  //   // add groups (up to first child)
  //   await Promise.all(
  //     config.groups.map(async (c: KeycloakGroup) => {
  //       await this.postGroup(
  //         { ...c, realm: config.realm, token: token },
  //         c.subGroups ? c.subGroups : [],
  //       );
  //     }),
  //   );
  //   // add users (update if already exists)
  //   await Promise.all(
  //     config.users.map(async (c: KeycloakUser) => {
  //       await this.saveUser(token, config.realm, c);
  //     }),
  //   );
  // }

  // async resetConfig(token: string, config: KeycloakConfigDto): Promise<void> {
  //   this.logger.log('Deleting resources');

  //   // delete clients
  //   const clientsName = config.clients.map((c) => c.clientId);
  //   const list = await this.clientsList({ token, realm: config.realm });
  //   const filtered = list.filter((c) => clientsName.includes(c.clientId));
  //   await Promise.all(
  //     filtered.map(async (c) => {
  //       try {
  //         await this.deleteClient({
  //           token: token,
  //           realm: config.realm,
  //           name: c.id,
  //         });
  //       } catch (e) {
  //         this.logger.warn(e.message);
  //       }
  //     }),
  //   );
  //   // delete all roles
  //   let roles = await this.rolesList({ token, realm: config.realm });
  //   roles = roles.filter((r) => r.name.indexOf('default') == -1);
  //   await Promise.all(
  //     roles.map(async (r) => {
  //       try {
  //         await this.deleteRole(token, config.realm, r.name);
  //       } catch (e) {
  //         this.logger.warn(e.message);
  //       }
  //     }),
  //   );
  //   // delete all groups
  //   const groups = await this.getKeycloakGroups({ token, realm: config.realm });
  //   await Promise.all(
  //     groups.map(async (c: KeycloakGroup) => {
  //       try {
  //         await this.deleteGroup({
  //           name: c.name,
  //           realm: config.realm,
  //           token: token,
  //         });
  //       } catch (e) {
  //         this.logger.warn(e.message);
  //       }
  //     }),
  //   );
  //   // Note: keep users
  // }

  async export(data: KeycloakRealmExportDto): Promise<any> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      throw new InternalServerErrorException(e.message);
    }
  }

  // async import(data: KeycloakRealmImportDto): Promise<any> {
  //   try {
  //     const res = await this.client.post(
  //       `${this.keycloakUrl}/admin/realms`,
  //       data.content,
  //       {
  //         headers: {
  //           'content-type': 'application/json',
  //           Authorization: `bearer ${data.token}`,
  //         },
  //       },
  //     );
  //     return res.data;
  //   } catch (e) {
  //     this.logger.error(e);
  //     return new InternalServerErrorException(e.message);
  //   }
  // }

  async usersList(data: KeycloakUsersListDto): Promise<any> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/users`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      throw new InternalServerErrorException(e.message);
    }
  }

  async clientsList(
    data: KeycloakClientsListDto,
  ): Promise<KeycloakClientResponseDto[]> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients?clientId=${
          data.clientId || ''
        }&search=${data.exactMatch ? 'false' : 'true'}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      this.printErrorStack('clientsList', e);
    }
  }

  async rolesList(data: KeycloakRolesListDto): Promise<any> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/roles`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      throw new InternalServerErrorException(e.message);
    }
  }

  async getKeycloakAdminToken(login: KeycloakLoginDto): Promise<string> {
    const token = await this.getToken(login);
    return token.access_token;
  }

  async healthcheck(path?: 'ready' | 'started' | 'live') {
    try {
      await this.client.get(
        `${this.keycloakAdminUrl}/health${path ? '/' + path : ''}`,
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  async getToken(
    req: KeycloakLoginDto,
    publicUrl = false,
  ): Promise<KeycloakTokenDto> {
    const { username, password } = req;

    const clientId =
      req.clientId || this.config.get('AUTH_KEYCLOAK_ADMIN_CLIENT_ID');
    const grantType = req.grantType || 'password';
    const realm = req.realm || this.config.get('AUTH_KEYCLOAK_ADMIN_REALM');

    if (!username || !password) {
      throw new BadRequestException(`username or password missing`);
    }

    const data: any =
      grantType === 'password'
        ? {
            username,
            password,
            grant_type: grantType,
          }
        : {
            client_id: username,
            client_secret: password,
            grant_type: grantType,
          };

    if (req.audience) data.audience = req.audience;

    const base64Auth = Buffer.from(`${clientId}:${password}`, 'utf8').toString(
      'base64',
    );

    try {
      const res = await this.client.post(
        `${
          publicUrl ? this.keycloakPublicUrl : this.keycloakUrl
        }/realms/${realm}/protocol/openid-connect/token`,
        data,
        {
          headers: {
            Authorization: `Basic ${base64Auth}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
        },
      );
      return res.data;
    } catch (e) {
      throw new InternalServerErrorException(
        `failed to get token, ${e.message}`,
      );
    }
  }

  async getRefreshToken(
    req: KeycloakGetRefreshTokenDto,
    publicUrl = false,
  ): Promise<KeycloakTokenDto> {
    const { refreshToken, clientId, realm, accessToken } = req;

    if (!refreshToken || !clientId) {
      throw new BadRequestException(`refreshToken or clientId missing`);
    }
    if (!accessToken) {
      throw new BadRequestException(`accessToken missing`);
    }

    const data = {
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    };

    try {
      const res = await this.client.post(
        `${
          publicUrl ? this.keycloakPublicUrl : this.keycloakUrl
        }/realms/${realm}/protocol/openid-connect/token`,
        data,
        {
          headers: {
            Authorization: `Basic ${accessToken}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
        },
      );
      return res.data;
    } catch (e) {
      throw new InternalServerErrorException(
        `failed to get token, ${e.message}`,
      );
    }
  }

  async listGroups(
    req: KcApiParam<{ search?: string; first?: number; max?: number }>,
  ) {
    try {
      const qs = [
        `first=${req.data?.first || 0}`,
        `max=${req.data?.max || 1000}`,
      ];
      if (req.data?.search)
        qs.push(`search=${encodeURIComponent(req.data?.search)}`);

      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${req.realm}/groups?${qs.join('&')}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );
      return res.data as GroupRepresentation[];
    } catch (e) {
      this.printErrorStack('listGroups', e);
    }
  }

  async listUsers(
    token: string,
    realm: string,
    filter?: {
      id?: string;
      username?: string;
      exact?: boolean;
    },
  ): Promise<KeycloakUserRecord[]> {
    try {
      let qs = '';
      if (filter) {
        if (filter.username) {
          qs = `?username=${filter.username}`;
        }
        if (filter.id) {
          qs = qs.length ? `${qs}&` : '?';
          qs = `id=${filter.id}`;
        }
        if (qs.length) {
          const exact = filter.exact === false ? 'false' : 'true';
          qs = `${qs}&exact=${exact}`;
        }
      }

      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${realm}/users${qs}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('listUsers', e);
    }
  }

  async getUser(
    token: string,
    realm: string,
    userId: string,
  ): Promise<KeycloakUserRecord> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${realm}/users/${userId}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      this.printErrorStack('getUsers', e);
    }
  }

  async createGroup(group: KeycloakGroupsCreationDto): Promise<any> {
    try {
      // await this.postGroup(group, [{ name: 'Admin' }, { name: 'User' }]);
      return await this.postGroup(group, []);
    } catch (e) {
      this.printErrorStack('createGroup', e);
    }
  }

  async postGroup(
    data: KeycloakGroupsCreationDto,
    subgroups?: { name: string }[],
  ) {
    try {
      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${data.realm}/groups`,
        {
          name: data.name,
        },
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('postGroup', e);
    }

    //childs
    if (subgroups && subgroups.length > 0) {
      const groupsList = await this.listGroups({
        ...data,
        data: {
          search: data.name,
        },
      });
      const filterParent = groupsList.filter((g) => g.name === data.name);
      if (filterParent.length > 0) {
        for (const subgroup of subgroups) {
          await this.postChildGroup(data, filterParent[0].id, subgroup.name);
        }
      }
    }
  }

  async postChildGroup(group, parentId, childName) {
    const data = {
      name: childName,
    };
    try {
      const res = await this.client.post(
        `${this.keycloakUrl}/admin/realms/${group.realm}/groups/${parentId}/children`,
        data,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${group.token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      this.printErrorStack('postChildGroup', e);
    }
  }

  async deleteGroup(req: { id: string } & KcApiBaseParams) {
    try {
      await this.client.delete(
        `${this.keycloakUrl}/admin/realms/${req.realm}/groups/${req.id}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('deleteGroup', e);
    }
  }

  async createClient(
    data: KeycloakClientsCreationDto,
  ): Promise<ClientCreatedDto> {
    const topics = this.platformTopics.toJSON();

    const toObject = (
      values: string[] | ClientCreateResource[] | ClientCreateScope[],
    ) => {
      if (!values) return [];
      return values.map((obj) => {
        if (typeof obj === 'string') return { name: obj };
        return obj;
      });
    };

    let resources: ClientCreateResource[] = toObject(data.resources);
    let scopes: ClientCreateScope[] = toObject(data.scopes);
    let policies = [];

    // set default if not defined
    if (!resources.length && !scopes.length) {
      resources = Object.values(
        topics.reduce(
          (o, { resource, scope }) => {
            const scopeName = `${resource}:${scope}`;
            o[resource] = o[resource] || {
              name: resource,
              scopes: [scopeName],
              // policies: [{ name: 'same-client' }],
            };

            if (!o[resource].scopes.includes(scopeName))
              o[resource].scopes.push(scopeName);
            return o;
          },
          {} as Record<string, ClientCreateResource>,
        ),
      );

      scopes = Array.from(
        new Set(
          resources.reduce((list, { scopes }) => {
            return [...list, ...scopes];
          }, [] as string[]),
        ),
      ).map(
        (name) =>
          ({
            name,
          }) as ClientCreateScope,
      );

      policies = [
        {
          id: uuidv4(),
          name: SAME_CLIENT_POLICY_NAME,
          description: '',
          type: 'client',
          logic: 'POSITIVE',
          decisionStrategy: 'AFFIRMATIVE',
          scopes: scopes.map((r) => r.name),
          resources: resources.map((r) => r.name),
          config: {
            clients: `[\"${data.name}\"]`,
          },
        },
      ];
    }

    const payload = clientDefaultConfiguration({
      resources,
      scopes,
      policies,
      client: {
        public: data.public,
        name: data.name,
        clientId: data.name,
        secret: data.secret,
        description: data.description,
        authorizationServicesEnabled: data.authorizationEnabled,
      },
    });

    try {
      if (data.public) {
        payload.rootUrl = data.rootUrl || '';
        if (data.redirectUrl) {
          payload.redirectUris = [data.redirectUrl];
          payload.attributes = {
            'post.logout.redirect.uris': data.redirectUrl,
          };
        }
      }

      this.logger.verbose(`Creating client ${data.name}`);
      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients`,
        payload,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('createClient', e);
    }

    const list = await this.clientsList({
      ...data,
      clientId: payload.clientId,
    });
    if (!list.length) {
      throw new NotFoundException(`Cannot find client`);
    }

    const clientId = list[0].id;
    this.logger.verbose(`Remove JS policies`);
    const clientPolicies = await this.searchClientPolicies({
      name: '',
      clientId,
      realm: data.realm,
      token: data.token,
    });

    await Promise.all(
      clientPolicies
        .filter((p) => p.type === 'js')
        .map((p) =>
          this.deleteClientPolicy({
            clientId,
            policyId: p.id,
            realm: data.realm,
            token: data.token,
          }),
        ),
    );

    return {
      id: clientId,
      clientId: payload.name,
      resources,
      policies,
    };
  }

  async createClientPermissions(
    data: CreateClientPermissionsDto,
  ): Promise<void> {
    const { resources, clientId } = data;

    const policyList = data.policies || [];

    if (!policyList.length) {
      policyList.push({
        name: SAME_CLIENT_POLICY_NAME,
        id: undefined,
      });
    }

    const policies: string[] = [];
    for (const partialPolicy of policyList) {
      if (partialPolicy.id) {
        policies.push(partialPolicy.id);
        continue;
      }

      const policy = await this.getPolicyByName({
        ...data,
        name: partialPolicy.name,
      });
      if (!policy || !policy.id) {
        this.logger.warn(`Policy ${partialPolicy.name} not found`);
        continue;
      }
      policies.push(policy.id);
    }

    const permissions = await this.listClientPermissions({ ...data });

    this.logger.verbose(
      `Creating client permissions for ${
        data.clientId
      } policies=${policies} resources=${resources.map(
        (r) => `${r.name}[${(r.scopes || []).join(',')}]`,
      )}`,
    );

    await Promise.all(
      resources.map((resource) => {
        return Promise.all(
          (resource.scopes || []).map(async (scope: string) => {
            const permissionName = `${resource.name}.${scope}`;
            const scopeName = `${resource.name}:${scope}`;

            const createPermissionPayload: CreateClientPermissionDto = {
              type: 'scope',
              clientId,
              name: permissionName,
              policies: policies.map((id) => ({ id })),
              resources: [
                {
                  name: resource.name,
                  scopes: [scopeName],
                  id: resource.id,
                },
              ],
              scopes: [{ name: scopeName }],
              realm: data.realm,
              token: data.token,
            };

            const exists = permissions.filter((p) => p.name === permissionName);
            if (exists.length) {
              if (data.forceOverwrite) {
                this.logger.verbose(
                  `Removing existing permission ${permissionName} for clientId=${clientId}`,
                );
                await this.deletePermission({
                  ...data,
                  clientId,
                  id: exists[0].id,
                });
              } else {
                this.logger.verbose(
                  `Skip existing permission ${permissionName} for clientId=${clientId}`,
                );
                return exists[0];
              }
            }
            return await this.createClientPermission(createPermissionPayload);
          }),
        );
      }),
    );
    this.logger.verbose(`Permissions created for clientId=${clientId}.`);
  }

  async deleteClient(data: KeycloakClientsCreationDto): Promise<any> {
    try {
      const res = await this.client.delete(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.name}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      this.printErrorStack('deleteClient', e);
    }
  }

  async listClientRoles(
    token: string,
    realm: string,
    clientId: string,
  ): Promise<KeycloakRoleDto[]> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${realm}/clients/${clientId}/roles`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      this.printErrorStack('listClientRoles', e);
    }
  }

  async listRealmRoles(
    token: string,
    realm: string,
    from = 0,
    size = 1000,
  ): Promise<KeycloakRoleDto[]> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${realm}/roles?first=${from}&max=${size}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      this.printErrorStack('listRealmRoles', e);
    }
  }

  async deleteRealmRole(
    token: string,
    realm: string,
    roleId: string,
  ): Promise<void> {
    try {
      await this.client.delete(
        `${this.keycloakUrl}/admin/realms/${realm}/roles-by-id/${roleId}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('deleteRealmRole', e);
    }
  }

  async addClientRole(
    token: string,
    realm: string,
    clientId: string,
    data: KeycloakRoleCreateDto,
  ): Promise<void> {
    this.logger.verbose(`Add role ${data.name}`);
    try {
      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${realm}/clients/${clientId}/roles`,
        data,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('addClientRole', e);
    }
  }

  async addClientRolePolicy(
    req: KeycloakRolePolicyCreateRequestDto,
  ): Promise<void> {
    this.logger.verbose(`Add client role-based policy ${req.data.name}`);
    try {
      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${req.realm}/clients/${req.clientId}/authz/resource-server/policy/role`,
        req.data,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('addClientRolePolicy', e);
    }
  }

  async addClientGroupPolicy(
    req: { clientId: string } & KcApiParam<KeycloakGroupPolicyCreateDto>,
  ): Promise<void> {
    this.logger.verbose(`Add client role-based policy ${req.data.name}`);
    try {
      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${req.realm}/clients/${req.clientId}/authz/resource-server/policy/group`,
        req.data,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('addClientGroupPolicy', e);
    }
  }

  async addRealmRole(
    token: string,
    realm: string,
    data: KeycloakRoleCreateDto,
  ): Promise<void> {
    this.logger.verbose(`Add role ${data.name}`);
    try {
      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${realm}/roles`,
        data,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('addRealmRole', e);
    }
  }

  async deleteRole(token: string, realm: string, name: string): Promise<void> {
    try {
      await this.client.delete(
        `${this.keycloakUrl}/admin/realms/${realm}/roles/${name}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('deleteRole', e);
    }
  }

  async deleteClientResource(data: {
    realm: string;
    token: string;
    clientId: string;
    resourceId: string;
  }) {
    try {
      await this.client.delete(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/resource/${data.resourceId}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('deleteClientResource', e);
    }
  }

  async deleteClientScope(data: {
    realm: string;
    token: string;
    clientId: string;
    scopeId: string;
  }) {
    try {
      await this.client.delete(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/scope/${data.scopeId}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('deleteClientScope', e);
    }
  }

  async updateUser(data: {
    token: string;
    realm: string;
    user: KeycloakUserRecord;
  }) {
    try {
      await this.client.put(
        `${this.keycloakUrl}/admin/realms/${data.realm}/users/${data.user.id}`,
        data.user,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('updateUser', e);
    }
  }

  async saveUser(token: string, realm: string, data: KeycloakUser) {
    this.logger.verbose(`Add user username=${data.username}`);
    try {
      const filtered = await this.listUsers(token, realm, {
        username: data.username,
        exact: true,
      });

      const payload = { ...data };

      if (payload.groups) delete payload.groups;
      if (payload.password) delete payload.password;

      // Note: realmRoles seems to be ignored (keycloak bug)
      if (filtered.length == 0) {
        await this.client.post(
          `${this.keycloakUrl}/admin/realms/${realm}/users`,
          payload,
          {
            headers: {
              'content-type': 'application/json',
              Authorization: `bearer ${token}`,
            },
          },
        );
      } else {
        this.logger.verbose('Update user');
        //do not update credentials
        delete payload.credentials;
        await this.client.put(
          `${this.keycloakUrl}/admin/realms/${realm}/users/${filtered[0].id}`,
          payload,
          {
            headers: {
              'content-type': 'application/json',
              Authorization: `bearer ${token}`,
            },
          },
        );
      }

      if (data.groups && data.groups.length) {
        await this.mapGroups(data.groups, data.username, token, realm);
      }

      const users = await this.listUsers(token, realm, {
        username: data.username,
        exact: true,
      });
      const user = users.length ? users[0] : null;

      if (user && data.password) {
        await this.resetUserPassword({
          realm,
          token,
          userId: user.id,
          password: data.password,
          temporary: false,
        });
      }

      return user;
    } catch (e) {
      this.printErrorStack('saveUser', e);
    }
  }

  async mapGroups(
    groups: string[],
    username: string,
    token: string,
    realm: string,
  ): Promise<void> {
    const filtered = await this.listUsers(token, realm, {
      username,
      exact: true,
    });
    if (filtered.length == 0) {
      this.logger.error(`User not found for username: ${username}`);
      return;
    }
    const keycloakGroups = await this.listGroups({ token, realm });
    let groupIds: string[] = [];
    keycloakGroups.forEach((g) => {
      if (groups.includes(g.name)) {
        groupIds.push(g.id);
      }

      if (groups.includes(g.path)) {
        groupIds.push(g.id);
      }

      g.subGroups?.forEach((sg) => {
        if (groups.includes(sg.path)) {
          groupIds.push(sg.id);
        }
      });
    });

    groupIds = Array.from(new Set([...groupIds]));

    const q: KeycloakClientsUsersUpdateDto = {
      token,
      realm,
      userIds: [filtered[0].id],
      groupIds,
    };
    try {
      await this.joinGroups(q);
    } catch (e) {
      this.printErrorStack('mapGroups', e, false);
    }
  }

  async joinGroups(data: KeycloakClientsUsersUpdateDto): Promise<void> {
    try {
      const payload = { groups: data.groupIds };

      for (let i = 0; i < data.userIds.length; i++) {
        for (let j = 0; j < data.groupIds.length; j++) {
          this.logger.verbose(
            `User ${data.userIds[i]} join group ${data.groupIds[j]}`,
          );
          await this.client.put(
            `${this.keycloakUrl}/admin/realms/${data.realm}/users/${data.userIds[i]}/groups/${data.groupIds[j]}`,
            payload,
            {
              headers: {
                'content-type': 'application/json',
                Authorization: `bearer ${data.token}`,
              },
            },
          );
        }
      }
    } catch (e) {
      this.printErrorStack('updateUsers', e);
    }
  }

  async deleteUserByUsername(
    token: string,
    realm: string,
    username: string,
  ): Promise<void> {
    let userId: string;

    try {
      this.logger.verbose(`Removing user ${username}`);
      const filterParent = await this.listUsers(token, realm, {
        username,
        exact: true,
      });
      if (filterParent.length == 0) {
        this.logger.verbose(`no users with username: ${username}`);
        return;
      }
      userId = filterParent[0].id;
    } catch (e) {
      this.printErrorStack('deleteUserByUsername', e);
    }

    await this.deleteUserById(token, realm, userId);
  }

  async deleteUserById(
    token: string,
    realm: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.client.delete(
        `${this.keycloakUrl}/admin/realms/${realm}/users/${userId}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('deleteUserById', e);
    }
  }

  async getResourceServer(
    clientId: string,
    token: string,
    realm: string,
  ): Promise<void> {
    try {
      await this.client.get(
        `${this.keycloakUrl}/admin/realms/${realm}/clients/${clientId}/authz/resource-server`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('getResourceServer', e);
    }
  }

  async createClientPermission(data: CreateClientPermissionDto): Promise<any> {
    const policies = (data.policies || []).map((p) => p.id || p.name);

    this.logger.verbose(
      `creating permission ${data.name} policies=${policies} for clientId=${data.clientId}`,
    );

    const payload: KeycloakPermissionCreateDto = {
      policies,
      name: data.name,
      description: '',
      decisionStrategy: 'AFFIRMATIVE',
      resourceType: '',
    };

    if (data.resources) {
      payload.resources = (data.resources || []).map((r) => r.name);
    }

    if (data.scopes) {
      payload.scopes = (data.scopes || []).map(({ name }) => name);
    }

    try {
      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/permission/${data.type}`,
        payload,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('createClientPermission', e);
    }
  }

  // await this.kc.createClientResources({
  //   realm: this.realm,
  //   token: this.token,
  //   clientId,
  //   resources: []
  // });

  // await this.kc.createClientScope({
  //   realm: this.realm,
  //   token: this.token,
  //   clientId,
  //   scopes: []
  // });

  async createClientScopes(req: CreateClientScopesDto) {
    const scopes: ClientCreateScope[] = [];
    for (const scope of req.scopes) {
      scopes.push(
        await this.createClientScope({
          ...req,
          scope,
        }),
      );
    }
    return scopes;
  }

  async createClientScope(
    data: ClientCreateScopeReq,
  ): Promise<ClientCreateScope> {
    try {
      const res = await this.client.post(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/scope`,
        data.scope,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      this.logger.verbose(`Created scope ${data.scope.name}`);
      return res.data;
    } catch (e) {
      this.printErrorStack('createClientScope', e);
    }
  }

  async createClientResources(req: CreateClientResourcesDto) {
    try {
      const resources: ClientCreateResource[] = [];
      for (const resource of req.resources) {
        const scopes = await this.createClientScopes({
          clientId: req.clientId,
          realm: req.realm,
          token: req.token,
          scopes: resource.scopes.map((name) => ({ name })),
        });

        const res = await this.createClientResource({
          ...req,
          resource: {
            ...resource,
            scopes: scopes.map(({ name }) => name),
          },
        });

        resources.push(res.data);
      }
      return resources;
    } catch (e) {
      this.printErrorStack('createClientResources', e);
    }
  }

  async createClientResource(
    data: ClientCreateResourceReq,
  ): Promise<ClientCreateResource> {
    try {
      const res = await this.client.post(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/resource`,
        data.resource,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      this.logger.verbose(`Created resource ${data.resource.name}`);
      return res.data;
    } catch (e) {
      this.printErrorStack('createClientResource', e);
    }
  }

  async updateClientResource(
    data: ClientCreateResourceReq,
  ): Promise<ClientCreateResource> {
    const resources = await this.listClientResources(data);

    const found = resources.filter((r) => r.name === data.resource.name);
    if (!found.length)
      throw new NotFoundException(`Resource ${data.resource.name} not found`);

    const allScopes = await this.listClientScopes({
      ...data,
    });

    // create scopes if not existing yet
    const scopes = [];
    for (const scope of data.resource.scopes || []) {
      const exists = allScopes.filter((s) => scope === s.name);
      if (exists.length) {
        scopes.push(exists[0]);
        continue;
      }
      const newScope = await this.createClientScope({
        ...data,
        scope: {
          name: scope,
        },
      });
      scopes.push(newScope);
    }

    const resource = {
      ...found[0],
      ...data.resource,
      scopes,
    };

    try {
      const res = await this.client.put(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/resource/${resource._id}`,
        resource,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      this.logger.verbose(`updated resource ${data.resource.name}`);
      return res.data;
    } catch (e) {
      this.printErrorStack('updateClientResource', e);
    }
  }

  async searchClientPolicies(
    payload: ClientPolicySearchDto,
  ): Promise<ClientPolicyRecordDto[]> {
    try {
      this.logger.verbose(
        `search policies ${payload.name} for clientId=${payload.clientId}`,
      );
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${payload.realm}/clients/${payload.clientId}/authz/resource-server/policy?first=0&max=10&permission=false&name=${payload.name}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${payload.token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      this.printErrorStack('searchClientPolicies', e);
    }
  }

  async deleteClientPolicy(payload: ClientPolicyRemoveDto): Promise<void> {
    try {
      this.logger.verbose(
        `delete policy ${payload.policyId} for clientId=${payload.clientId}`,
      );
      await this.client.delete(
        `${this.keycloakUrl}/admin/realms/${payload.realm}/clients/${payload.clientId}/authz/resource-server/policy/${payload.policyId}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${payload.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('deleteClientPolicy', e);
    }
  }

  async evaluatePermission(
    data: EvaluatePermissionReqDto,
  ): Promise<EvaluationResultResponseDto> {
    try {
      // this.logger.verbose(`evaluating permission for ${data.clientId}`);

      const res = await this.client.post(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/policy/evaluate`,
        data.payload,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('evaluatePermission', e);
    }
  }

  async listClientPermissions(
    data: ListPermissionRequestDto,
  ): Promise<KeycloakPermissionDto[]> {
    try {
      data.from = data.from || 0;
      data.to = data.to || 1000;

      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/permission?first=${data.from}&max=${data.to}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('listClientPermissions', e);
    }
  }

  async listPolicies(
    data: ListPoliciesRequestDto,
  ): Promise<KeycloakPolicyDto[]> {
    try {
      data.from = data.from || 0;
      data.to = data.to || 1000;

      let nameFilter = '';
      if (data.name) {
        nameFilter = `&name=${encodeURIComponent(data.name)}`;
      }

      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/policy?permission=false&first=${data.from}&max=${data.to}${nameFilter}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('listPolicies', e);
    }
  }

  async getPolicyByName(
    data: ListPoliciesRequestDto,
  ): Promise<KeycloakPolicyDto> {
    const policies = await this.listPolicies(data);
    return policies.length === 1 ? policies[0] : null;
  }

  async getPermissionResources(
    data: GetPermissionResourcesRequestDto,
  ): Promise<ClientPermissionResourceDto[]> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/policy/${data.permissionId}/resources`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('getPermissionResources', e);
    }
  }

  async listClientResources(
    data: ListClientResourcesRequestDto,
  ): Promise<KeycloakResourceDto[]> {
    try {
      const from = data.from || 0;
      const size = data.size || 1000;

      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/resource?first=${from}&max=${size}&permission=false`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('listClientResources', e);
    }
  }
  async listClientPolicies(
    data: ListClientPoliciesRequestDto,
  ): Promise<KeycloakPolicyDto[]> {
    try {
      const from = data.from || 0;
      const size = data.size || 1000;

      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/policy?first=${from}&max=${size}&permission=false`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('listClientResources', e);
    }
  }

  async listClientScopes(
    data: ListClientScopesRequestDto,
  ): Promise<KeycloakScopeDto[]> {
    try {
      const from = data.from || 0;
      const size = data.size || 1000;

      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/scope?first=${from}&max=${size}&deep=false`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('listClientScopes', e);
    }
  }

  async createResourcePermission(
    req: CreateResourcePermissionRequestDto,
  ): Promise<void> {
    try {
      const res = await this.client.post(
        `${this.keycloakUrl}/admin/realms/${req.realm}/clients/${req.clientId}/authz/resource-server/permission/resource`,
        req.data,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('createResourcePermission', e);
    }
  }

  async updateResourcePermission(
    req: UpdateResourcePermissionRequestDto,
  ): Promise<void> {
    try {
      const res = await this.client.put(
        `${this.keycloakUrl}/admin/realms/${req.realm}/clients/${req.clientId}/authz/resource-server/permission/resource/${req.policyId}`,
        req.data,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('createResourcePermission', e);
    }
  }

  async getPermissionScopes(
    data: GetPermissionScopesRequestDto,
  ): Promise<ClientPermissionScopeDto[]> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/policy/${data.permissionId}/scopes`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('getPermissionScopes', e);
    }
  }

  async getPermissionPolicies(
    data: GetPermissionPoliciesRequestDto,
  ): Promise<ClientPermissionPolicyDto[]> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/authz/resource-server/policy/${data.permissionId}/associatedPolicies`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('getPermissionPolicies', e);
    }
  }

  async updatePermission(req: UpdatePermissionRequestDto): Promise<void> {
    try {
      await this.client.put(
        `${this.keycloakUrl}/admin/realms/${req.realm}/clients/${req.clientId}/authz/resource-server/permission/scope/${req.permission.id}`,
        req.permission,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('updatePermission', e);
    }
  }

  async deletePermission(
    req: { clientId: string; id: string } & KcApiBaseParams,
  ): Promise<void> {
    try {
      await this.client.delete(
        `${this.keycloakUrl}/admin/realms/${req.realm}/clients/${req.clientId}/authz/resource-server/permission/scope/${req.id}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('deletePermission', e);
    }
  }

  async assignClientRoles(req: AssignClientRolesRequestDto): Promise<void> {
    try {
      const clientRoles = await this.listClientRoles(
        req.token,
        req.realm,
        req.client.id,
      );

      const roles = clientRoles
        .filter((r) => req.roles.includes(r.name))
        .map(({ name, id }) => ({ name, id }));

      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${req.realm}/users/${req.userId}/role-mappings/clients/${req.client.id}`,
        roles,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('assignClientRoles', e);
    }
  }

  async assignRealmRoles(req: AssignRealmRolesRequestDto): Promise<void> {
    try {
      const realmRoles = await this.listRealmRoles(req.token, req.realm);

      const roles = realmRoles
        .filter((r) => req.roles.includes(r.name))
        .map(({ name, id }) => ({ name, id }));

      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${req.realm}/users/${req.userId}/role-mappings/realm`,
        roles,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('assignRealmRoles', e);
    }
  }

  async getPermissions(
    payload: ClientPermissionRequestDto,
  ): Promise<ClientPermissionDto[]> {
    const { token, realm, clientId } = payload;

    const data = {
      audience: clientId,
      grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      response_mode: 'permissions',
      permission: payload.scopes.map((scope) => `${payload.resource}#${scope}`),
    };

    const url = `${this.keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;

    const options = {
      method: 'POST',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token}`,
      },
      data,
      url,
    };
    try {
      const res = await axios(options);
      return res.data;
    } catch (e: any) {
      if (isAxiosError(e)) {
        const err = e as AxiosError;
        if (err.code === 'ERR_BAD_REQUEST') {
          return [];
        }
      }
      this.printErrorStack('getPermissions', e);
    }
  }

  async getClientSecret(
    req: GetClientSecretRequestDto,
  ): Promise<ClientCredentialsDto> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${req.realm}/clients/${req.clientId}/client-secret`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${req.token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      this.printErrorStack('getClientSecret', e);
    }
  }

  async createRealm(
    data: KeycloakCreateRealmRequestDto,
  ): Promise<KeycloakRealmDto> {
    this.logger.log(`Create realm ${data.realm}`);
    try {
      await this.client.post(
        `${this.keycloakUrl}/admin/realms`,
        {
          realm: data.realm,
          enabled: data.enabled === undefined ? true : data.enabled,
        },
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      const realms = await this.listRealms({
        ...data,
      });

      const filtered = realms.filter((r) => r.realm === data.realm);
      return filtered.length ? filtered[0] : null;
    } catch (e) {
      this.printErrorStack('createRealm', e);
    }
  }

  async deleteRealmByName(data: KeycloakRealmRequestDto) {
    const realms = await this.listRealms(data);

    const matches = realms.filter((r) => r.realm.indexOf(data.realm) > -1);
    for (const realm of matches) {
      await this.deleteRealm({
        ...data,
        realm: realm.realm,
      });
    }
  }

  async deleteGroupByName(req: { name: string } & KcApiBaseParams) {
    const groups = await this.listGroups({
      ...req,
      data: { search: req.name },
    });
    for (const group of groups) {
      this.logger.verbose(`Remove group ${group.name}`);
      await this.deleteGroup({
        ...req,
        id: group.id,
      });
    }
  }

  async deleteRealm(data: KeycloakRealmRequestDto) {
    this.logger.log(`Delete realm ${data.realm}`);
    try {
      await this.client.delete(
        `${this.keycloakUrl}/admin/realms/${data.realm}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('deleteRealm', e);
    }
  }

  async listRealms(data: {
    token: string;
    realm?: string;
    briefRepresentation?: boolean;
  }): Promise<KeycloakRealmDto[]> {
    const briefRepresentation =
      data.briefRepresentation === true ? true : data.briefRepresentation;

    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms?briefRepresentation=${
          briefRepresentation === true ? 'true' : 'false'
        }`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      if (data.realm) {
        return res.data.filter((r) => r.realm.indexOf(data.realm) > -1);
      }

      return res.data;
    } catch (e) {
      this.printErrorStack('listRealms', e);
    }
  }

  async listRealmClientScopes(data: {
    token: string;
    realm: string;
    name?: string;
  }): Promise<RealmClientScopesDto[]> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/client-scopes`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      const list: RealmClientScopesDto[] = res.data;
      if (data.name) {
        return list.filter((s) => s.name === data.name);
      }
      return list;
    } catch (e) {
      this.printErrorStack('listRealmClientScopes', e);
    }
  }

  async listAllClientClientScopes(data: {
    token: string;
    realm: string;
    clientId: string;
    id?: string;
  }): Promise<ClientClientScopesDto[]> {
    const optional = await this.listClientClientScopes({
      ...data,
      type: 'optional',
    });
    const defaults = await this.listClientClientScopes({
      ...data,
      type: 'default',
    });

    return [...optional, ...defaults];
  }

  async listClientClientScopes(data: {
    token: string;
    realm: string;
    clientId: string;
    type: 'optional' | 'default';
    id?: string;
  }): Promise<ClientClientScopesDto[]> {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/${data.type}-client-scopes`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      const list: ClientClientScopesDto[] = res.data;
      if (data.id) {
        return list.filter((s) => s.id === data.id);
      }
      return list;
    } catch (e) {
      this.printErrorStack('listClientClientScopes', e);
    }
  }

  async assignClientClientScope(data: {
    token: string;
    realm: string;
    clientId: string;
    scopeId: string;
    type: 'default' | 'optional';
  }) {
    try {
      await this.client.put(
        `${this.keycloakUrl}/admin/realms/${data.realm}/clients/${data.clientId}/${data.type}-client-scopes/${data.scopeId}`,
        {},
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('assignClientClientScope', e);
    }
  }

  async createRealmClientScope(data: {
    token: string;
    realm: string;
    clientScope: CreateRealmClientScopeDto;
  }) {
    try {
      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${data.realm}/client-scopes`,
        data.clientScope,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      const scopes = await this.listRealmClientScopes({
        ...data,
        name: data.clientScope.name,
      });

      return scopes.length ? scopes[0] : null;
    } catch (e) {
      this.printErrorStack('createRealmClientScope', e);
    }
  }

  async createProtocolMapper(data: {
    token: string;
    realm: string;
    clientScopeId: string;
    protocolMapper: CreateProtocolMapperDto;
  }) {
    try {
      await this.client.post(
        `${this.keycloakUrl}/admin/realms/${data.realm}/client-scopes/${data.clientScopeId}/protocol-mappers/models`,
        data.protocolMapper,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('createRealmClientScope', e);
    }
  }

  async resetUserPassword(data: {
    token: string;
    realm?: string;
    userId: string;
    password: string;
    temporary?: boolean;
  }) {
    const { userId, password, temporary } = data;

    try {
      await this.client.put(
        `${this.keycloakUrl}/admin/realms/${data.realm}/users/${userId}/reset-password`,
        {
          type: 'password',
          value: password,
          temporary: temporary === true ? true : temporary,
        },
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('resetUserPassword', e);
    }
  }

  async updateRealmSettings(data: {
    token: string;
    realm?: string;
    config: Record<string, any>;
  }) {
    const config = await this.getRealmSettings({
      token: data.token,
      realm: data.realm,
    });

    if (!config) return;

    try {
      await this.client.put(
        `${this.keycloakUrl}/admin/realms/${data.realm}`,
        { ...config, ...data.config },
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
    } catch (e) {
      this.printErrorStack('updateRealmSettings', e);
    }
  }

  async getRealmSettings(data: { token: string; realm?: string }) {
    try {
      const res = await this.client.get(
        `${this.keycloakUrl}/admin/realms/${data.realm}`,
        {
          headers: {
            'content-type': 'application/json',
            Authorization: `bearer ${data.token}`,
          },
        },
      );
      return res.data;
    } catch (e) {
      this.printErrorStack('updateRealmSettings', e);
      return null;
    }
  }

  async login(data: {
    token: string;
    realm?: string;
    username: string;
    password: string;
    clientId: string;
    clientSecret: string;
  }): Promise<KeycloakTokenDto> {
    const { username, password, clientId, clientSecret } = data;

    try {
      const res = await this.client.post(
        `${this.keycloakUrl}/realms/${data.realm}/protocol/openid-connect/token`,
        {
          grant_type: 'password',
          client_id: clientId,
          client_secret: clientSecret,
          username,
          password,
          audience: clientId,
        },
        {
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            Authorization: `bearer ${data.token}`,
          },
        },
      );

      return res.data;
    } catch (e) {
      this.printErrorStack('login', e);
    }
  }
}
