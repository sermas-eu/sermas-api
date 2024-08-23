import { PlatformContextDto } from 'apps/platform/src/auth/platform.auth.dto';
import { KeycloakPermissionUpdateDto } from './keycloak.admin.dto';

export interface EvaluatePermissionResourceDto {
  name: string;
  scopes: { name: string }[];
}

export interface EvaluatePermissionReqDto {
  token: string;
  realm: string;
  clientId: string;
  payload: EvaluatePermissionDto;
}

export interface EvaluatePermissionDto {
  roleIds: string[];
  userId: string;
  resources: EvaluatePermissionResourceDto[];
  entitlements: boolean;
  context: Record<string, any>;
}

export interface ClientCreatedDto {
  id: string;
  clientId: string;
  resources: ClientCreateResource[];
  policies: ClientCreatePolicy[];
}

export interface CreateClientPermissionsDto {
  clientId: string;
  clientSecret?: string;
  resources: Partial<ClientCreateResource>[];
  policies?: Partial<ClientCreatePolicy>[];
  forceOverwrite?: boolean;
  realm: string;
  token: string;
}

export interface CreateClientResourcesDto {
  token: string;
  realm: string;
  clientId: string;
  resources: ClientCreateResource[];
}

export interface CreateClientScopesDto {
  token: string;
  realm: string;
  clientId: string;
  scopes: ClientCreateScope[];
}

export interface CreateClientPermissionDto {
  type: 'resource' | 'scope';
  token: string;
  realm: string;
  clientId: string;
  resources?: ClientCreateResource[];
  scopes?: Partial<ClientCreateScope>[];
  policies: Partial<ClientCreatePolicy>[];
  name: string;
}

export interface KeycloakClientDataDto extends Record<string, any> {
  clientId?: string;
  name: string;
  resources: ClientCreateResource[];
  scopes: ClientCreateScope[];
  policies: ClientCreatePolicy[];
}

export type KeycloakStrategy = 'AFFIRMATIVE' | 'UNANIMOUS' | 'CONSENSUS';

export interface KeycloakClientAuthorizationSettingsDto
  extends Record<string, any> {
  allowRemoteResourceManagement: boolean;
  decisionStrategy: KeycloakStrategy;
  policyEnforcementMode: 'ENFORCING';
  resources: ClientCreateResource[];
  scopes: ClientCreateScope[];
  policies: ClientCreatePolicy[];
}

export interface KeycloakPermissionCreateDto extends Record<string, any> {
  policies: string[];
  name: string;
  description: string;
  decisionStrategy: KeycloakStrategy;
  resourceType: string;
  resources?: string[];
  scopes?: string[];
}

export interface KeycloakClientCreateDto extends Record<string, any> {
  clientId?: string;
  name: string;
  publicClient: boolean;
  authorizationServicesEnabled: boolean;
  implicitFlowEnabled: boolean;
  directAccessGrantsEnabled: boolean;
  serviceAccountsEnabled: boolean;
  authorizationSettings: KeycloakClientAuthorizationSettingsDto;
  enabled: boolean;
  standardFlowEnabled: boolean;
  fullScopeAllowed: boolean;
  surrogateAuthRequired: boolean;
  webOrigins: string[];
}

export interface ClientCreateScope extends Record<string, any> {
  id?: string;
  name: string;
}

export interface ClientCreateScopeReq {
  realm: string;
  token: string;
  clientId: string;
  scope: ClientCreateScope;
}

export interface ClientCreateResource extends Record<string, any> {
  id?: string;
  name: string;
  scopes: string[];
}

export interface ClientCreateResourceReq {
  realm: string;
  token: string;
  clientId: string;
  resource: ClientCreateResource;
}

export interface ClientCreatePolicy extends KeycloakPolicyDto {
  id?: string;
  name: string;
  resources?: ClientCreateResource[];
}

export interface KeycloakResourceServer {
  id: string;
  clientId: string;
  name: string;
  allowRemoteResourceManagement: boolean;
  policyEnforcementMode: string;
  resources: any[];
  policies: any[];
  scopes: any[];
  decisionStrategy: string;
}

export interface EvaluationResultResponseDto {
  results: EvaluationResultDto[];
  entitlements: boolean;
  status: string;
  rpt: EvaluationResultRptDto;
}

export interface EvaluationResultDto {
  resource: EvaluationResultResourceDto;
  scopes: EvaluationResultScopeDto[];
  policies: EvaluationResultPolicyDto[];
  status: string;
  allowedScopes: EvaluationResultScopeDto[];
}

export interface EvaluationResultResourceDto {
  name: string;
  _id: string;
}

export interface EvaluationResultScopeDto {
  id: string;
  name: string;
}

export interface EvaluationResultPolicyDto {
  policy: EvaluationResultPolicy2Dto;
  status: string;
  associatedPolicies: any[];
  scopes: string[];
}

export interface EvaluationResultPolicy2Dto {
  id: string;
  name: string;
  description: string;
  type: string;
  resources: string[];
  scopes: string[];
  logic: string;
  decisionStrategy: string;
  config: Record<string, any>;
}

export interface EvaluationResultRptDto {
  exp: number;
  iat: number;
  jti: string;
  aud: string;
  sub: string;
  typ: string;
  azp: string;
  session_state: string;
  acr: string;
  'allowed-origins': string[];
  realm_access: EvaluationResultRealmAccessDto;
  resource_access: EvaluationResultResourceAccessDto;
  authorization: EvaluationResultAuthorizationDto;
  scope: string;
  sid: string;
  email_verified: boolean;
  preferred_username: string;
  given_name: string;
  family_name: string;
  email: string;
}

export interface EvaluationResultRealmAccessDto {
  roles: string[];
}

export interface EvaluationResultResourceAccessDto {
  account: EvaluationResultAccountDto;
}

export interface EvaluationResultAccountDto {
  roles: string[];
}

export interface EvaluationResultAuthorizationDto {
  permissions: any[];
}

export interface KeycloakClientResponseDto {
  id: string;
  clientId: string;
  name: string;
  surrogateAuthRequired: boolean;
  enabled: boolean;
  alwaysDisplayInConsole: boolean;
  clientAuthenticatorType: string;
  secret: string;
  redirectUris: any[];
  webOrigins: string[];
  notBefore: number;
  bearerOnly: boolean;
  consentRequired: boolean;
  standardFlowEnabled: boolean;
  implicitFlowEnabled: boolean;
  directAccessGrantsEnabled: boolean;
  serviceAccountsEnabled: boolean;
  authorizationServicesEnabled: boolean;
  publicClient: boolean;
  frontchannelLogout: boolean;
  protocol: string;
  attributes: Record<string, any>;
  authenticationFlowBindingOverrides: Record<string, any>;
  fullScopeAllowed: boolean;
  nodeReRegistrationTimeout: number;
  protocolMappers: KeycloakClientProtocolMapperDto[];
  defaultClientScopes: string[];
  optionalClientScopes: string[];
  access: KeycloakClientAccessDto;
}

export interface KeycloakClientProtocolMapperDto {
  id: string;
  name: string;
  protocol: string;
  protocolMapper: string;
  consentRequired: boolean;
  config: Record<string, any>;
}

export interface KeycloakClientAccessDto {
  view: boolean;
  configure: boolean;
  manage: boolean;
}

export interface ClientPermissionRequestDto extends PlatformContextDto {
  token: string;
  realm: string;
}

export interface ListPermissionRequestDto {
  token: string;
  realm: string;
  clientId: string;
  from?: number;
  to?: number;
}

export interface ListPoliciesRequestDto {
  token: string;
  realm: string;
  clientId: string;
  from?: number;
  to?: number;
  name?: string;
}

export class ClientPolicySearchDto {
  name: string;
  token: string;
  realm: string;
  clientId: string;
}

export class ClientPolicyRemoveDto {
  policyId: string;
  token: string;
  realm: string;
  clientId: string;
}

export class ClientPolicyRecordDto {
  id: string;
  name: string;
  description: string;
  type: string;
  logic: string;
  decisionStrategy: string;
  config: any;
}

export class ClientPermissionResourceDto {
  name: string;
  _id: string;
}

export class ClientPermissionScopeDto {
  name: string;
  id: string;
}

export class ClientPermissionPolicyDto {
  id: string;
  name: string;
  description: string;
  type: string;
  logic: string;
  decisionStrategy: string;
  config: Record<string, any>;
}

export class UpdatePermissionRequestDto {
  realm: string;
  token: string;
  clientId: string;
  permission: KeycloakPermissionUpdateDto;
}

export class KeycloakPolicyDto {
  id?: string;
  name: string;
  type: string;
  logic: string;
  decisionStrategy: string;
  config: Record<string, any>;
}

export class KeycloakResourceDto {
  _id: string;
  name: string;
  owner: { id: string; name: string };
  ownerManagedAccess: boolean;
  attributes: Record<string, any>;
  uris: string[];
  scopes?: { id: string; name: string }[];
  type?: string;
}

export class KeycloakScopeDto {
  id: string;
  name: string;
}

export class CreateResourcePermissionDto {
  resources: string[];
  policies: string[];
  name: string;
  description: string;
  decisionStrategy: string;
}

export class CreateResourcePermissionRequestDto {
  realm: string;
  token: string;
  clientId: string;
  data: CreateResourcePermissionDto;
}

export class UpdateResourcePermissionRequestDto extends CreateResourcePermissionRequestDto {
  policyId: string;
}
