import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ClientCreateResource,
  ClientCreateScope,
  KeycloakClientResponseDto,
} from './keycloack.authz.dto';

export class KeycloakLoginDto {
  @ApiProperty()
  username: string;
  @ApiProperty()
  password: string;
  @ApiProperty()
  clientId?: string;
  @ApiProperty()
  grantType?: string;
  @ApiProperty()
  realm?: string;
  @ApiProperty()
  audience?: string;
}

export class KeycloakGetRefreshTokenDto {
  @ApiProperty()
  refreshToken: string;
  @ApiProperty()
  accessToken?: string;
  @ApiProperty()
  clientId: string;
  @ApiProperty()
  realm?: string;
}

export class KeycloakGroupsDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  realm: string;
}

export class KeycloakUserRecord {
  id: string;
  createdTimestamp: number;
  username: string;
  enabled: boolean;
  totp: boolean;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  disableableCredentialTypes: any[];
  requiredActions: string[];
  notBefore: number;
  access: {
    manageGroupMembership: boolean;
    view: boolean;
    mapRoles: boolean;
    impersonate: boolean;
    manage: boolean;
  };
  email?: string;
  attributes?: Record<string, string | string[]>;
}

export class KeycloakGroupsCreationDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  realm: string;
  @ApiProperty()
  name: string;
}

export class KeycloakUsersListDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  realm: string;
}

export class KeycloakRealmExportDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  realm: string;
}

// export class KeycloakRealmImportDto {
//   @ApiProperty()
//   token: string;
//   @ApiProperty()
//   content: any;
// }

export class KeycloakClientsListDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  realm: string;
  @ApiPropertyOptional()
  clientId?: string;
  @ApiPropertyOptional()
  exactMatch?: boolean;
}

export class KeycloakRolesListDto extends KeycloakClientsListDto {}

export class KeycloakRolePolicyCreateRequestDto {
  realm: string;
  token: string;
  clientId: string;
  data: KeycloakRolePolicyCreateDto;
}

export abstract class KeycloakPolicy {
  name: string;
  description?: string;
  logic: 'POSITIVE' | 'NEGATIVE';
}

export class KeycloakRolePolicyCreateDto extends KeycloakPolicy {
  roles: { id: string; required: boolean }[];
}

export class KeycloakGroupPolicyCreateDto extends KeycloakPolicy {
  groupsClaim: string;
  groups: { id: string; extendChildren: boolean }[];
}

export class KeycloakApplyDto {
  @ApiProperty()
  realm: string;
}

export class KeycloakClientsCreationDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  realm: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  description?: string;
  @ApiProperty({ type: [String] })
  scopes?: string[] | ClientCreateScope[];
  @ApiProperty({ type: [String] })
  resources?: string[] | ClientCreateResource[];
  @ApiProperty()
  public?: boolean;
  @ApiProperty()
  rootUrl?: string;
  @ApiProperty()
  redirectUrl?: string;
  @ApiProperty()
  secret?: string;
  @ApiProperty()
  authorizationEnabled?: boolean;
}

export class KeycloakClientsUsersUpdateDto {
  @ApiProperty()
  token: string;
  @ApiProperty()
  realm: string;
  @ApiProperty({ type: [String] })
  userIds: string[];
  @ApiProperty({ type: [String] })
  groupIds: string[];
}

export class KeycloakClient {
  @ApiProperty()
  clientId: string;
  @ApiProperty()
  public: boolean;
  @ApiProperty()
  secret?: string;
  @ApiProperty()
  rootUrl?: string;
  @ApiProperty()
  redirectUrl?: string;
  @ApiProperty()
  resources?: string[];
  @ApiProperty()
  scopes?: string[];
}

export class KeycloakGroup {
  @ApiProperty()
  name: string;
  @ApiProperty()
  subGroups?: KeycloakGroup[];
}

export class KeycloakCredentials {
  @ApiProperty()
  credentialData: string;
  @ApiProperty()
  temporary: boolean;
}

export class KeycloakUser {
  @ApiProperty()
  enabled: boolean;
  @ApiProperty()
  username: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  emailVerified: boolean;
  @ApiProperty()
  credentials?: KeycloakCredentials;
  @ApiProperty()
  realmRoles?: string[];
  @ApiProperty()
  clientRoles?: KeycloakRoleDto[];
  @ApiProperty()
  groups?: string[];
  @ApiProperty()
  password?: string;
  @ApiPropertyOptional()
  firstName?: string;
  @ApiPropertyOptional()
  lastName?: string;
  @ApiProperty()
  attributes?: Record<string, string | string[]>;
}

export interface KeycloakRoleDto {
  id: string;
  name: string;
  composite: boolean;
  clientRole: boolean;
  containerId: string;
}

export class KeycloakRoleCreateDto {
  @ApiProperty()
  name: string;
  @ApiProperty()
  description?: string;
  @ApiProperty()
  metadata?: Record<string, any>;
}

export class KeycloakConfigDto {
  @ApiProperty()
  realm: string;
  @ApiProperty()
  clients: KeycloakClient[];
  @ApiProperty()
  roles: KeycloakRoleCreateDto[];
  @ApiProperty()
  groups: KeycloakGroup[];
  @ApiProperty()
  users: KeycloakUser[];
}

export class KeycloakTokenDto {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token?: string;
  token_type: string;
  id_token?: string;
  'not-before-policy': number;
  session_state: string;
  scope: string;
}

export class KeycloakPermissionDto {
  id: string;
  name: string;
  description: string;
  type: string;
  logic: string;
  decisionStrategy: string;
  resourceType: string;
}

export class KeycloakPermissionUpdateDto extends KeycloakPermissionDto {
  resources: string[];
  policies: string[];
  scopes: string[];
}

export class GetPermissionResourcesRequestDto {
  realm: string;
  token: string;
  clientId: string;
  permissionId: string;
}

export class ListClientResourcesRequestDto {
  realm: string;
  token: string;
  clientId: string;
  from?: number;
  size?: number;
}

export class ListClientPoliciesRequestDto extends ListClientResourcesRequestDto {}
export class ListClientScopesRequestDto extends ListClientResourcesRequestDto {}

export class GetPermissionScopesRequestDto extends GetPermissionResourcesRequestDto {}
export class GetPermissionPoliciesRequestDto extends GetPermissionResourcesRequestDto {}

export class AssignRealmRolesDto {
  userId: string;
  roles: string[];
}

export class AssignClientRolesDto extends AssignRealmRolesDto {
  client: KeycloakClientResponseDto;
}

export class AssignClientRolesRequestDto extends AssignClientRolesDto {
  token: string;
  realm: string;
}

export class AssignRealmRolesRequestDto extends AssignRealmRolesDto {
  token: string;
  realm: string;
}

export class GetClientSecretRequestDto {
  token: string;
  realm: string;
  clientId: string;
}

export class ClientCredentialsDto {
  type: string;
  value: string;
}

export class KeycloakRealmRequestDto {
  token: string;
  realm: string;
}

export class KeycloakCreateRealmRequestDto extends KeycloakRealmRequestDto {
  enabled?: boolean;
}

export class KeycloakRealmDto {
  id: string;
  realm: string;
  displayName?: string;
  displayNameHtml?: string;
  enabled: boolean;
}

export interface ClientClientScopesDto {
  id: string;
  name: string;
}

export interface RealmClientScopesDto {
  id: string;
  name: string;
  description: string;
  protocol: string;
  attributes: RealmClientScopesAttributes;
  protocolMappers?: RealmClientScopesProtocolMapper[];
}

export interface RealmClientScopesAttributes extends Record<string, string> {
  'include.in.token.scope'?: string;
  'display.on.consent.screen': string;
  'consent.screen.text'?: string;
}

export interface RealmClientScopesProtocolMapper {
  id: string;
  name: string;
  protocol: string;
  protocolMapper: string;
  consentRequired: boolean;
  config: RealmClientScopesConfig;
}

export interface RealmClientScopesConfig extends Record<string, string> {
  'userinfo.token.claim'?: string;
  'user.attribute'?: string;
  'id.token.claim'?: string;
  'access.token.claim'?: string;
  'claim.name'?: string;
  'jsonType.label'?: string;
  single?: string;
  'attribute.nameformat'?: string;
  'attribute.name'?: string;
  'user.attribute.formatted'?: string;
  'user.attribute.country'?: string;
  'user.attribute.postal_code'?: string;
  'user.attribute.street'?: string;
  'user.attribute.region'?: string;
  'user.attribute.locality'?: string;
  multivalued?: string;
}

export interface CreateRealmClientScopeDto {
  name: string;
  description: string;
  attributes: CreateRealmClientScopeAttributes;
  type: string;
  protocol: string;
}

export interface CreateRealmClientScopeAttributes
  extends Record<string, string> {
  'consent.screen.text': string;
  'display.on.consent.screen': string;
  'include.in.token.scope': string;
  'gui.order': string;
}

export interface CreateProtocolMapperDto {
  protocol: string;
  protocolMapper: string;
  name: string;
  config: CreateProtocolMapperConfig;
}

export interface CreateProtocolMapperConfig
  extends Record<string, string | boolean> {
  'user.attribute': string;
  'claim.name': string;
  'jsonType.label': string;
  'id.token.claim': boolean;
  'access.token.claim': string;
  'userinfo.token.claim': string;
  multivalued: boolean;
  'aggregate.attrs': boolean;
}
