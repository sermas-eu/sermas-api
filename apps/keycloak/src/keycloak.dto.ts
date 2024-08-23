export interface ClientLoginDto {
  clientId: string;
  clientSecret: string;
  audience?: string;
  realm?: string;
}

export interface ClientRefreshTokenDto {
  clientId: string;
  refreshToken: string;
  accessToken?: string;
}

export interface SystemClientCreateDto {
  clientId: string;
  permissions?: string[];
}

export interface AddClientOptions {
  allowWildcard?: boolean;
  allowScopeWildcard?: boolean;
  allowFineGrained?: boolean;
  upsert?: boolean;
}

export interface AddClientDto {
  clientId: string;
  description?: string;
  permissions?: string[];
  options?: AddClientOptions;
  attributes?: string[];
  secret?: string;
  authorizationEnabled?: boolean;
  removeIfExists?: boolean;
}

export interface AddAppClientDto extends AddClientDto {
  clientRoles: string[];
  realmRoles: string[];
}

export interface AddPlatformClientDto extends AddClientDto {
  adminRole?: string;
}

export class ClientPermissionDto {
  rsid: string;
  rsname: string;
  scopes: string[];
}

export class KeycloakJwtTokenDto {
  [key: string]: any;
  exp: number;
  iat: number;
  jti: string;
  iss: string;
  aud: string;
  sub: string;
  typ: string;
  azp: string;
  acr: string;
  'allowed-origins': string[];
  realm_access: KeycloakJwtTokenRealmAccess;
  resource_access: KeycloakJwtTokenResourceAccess;
  scope: string;
  email_verified: boolean;
  clientId: string;
  clientHost: string;
  preferred_username: string;
  clientAddress: string;
  appId?: string[];
  roles?: string[];
}

export interface KeycloakJwtTokenRealmAccess {
  [key: string]: string[];
  roles: string[];
}

export class KeycloakJwtTokenResourceAccess {
  [key: string]: KeycloakJwtTokenRealmAccess;
  account: KeycloakJwtTokenRealmAccess;
}
