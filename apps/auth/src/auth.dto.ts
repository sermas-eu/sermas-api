import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KeycloakTokenDto } from 'apps/keycloak/src/keycloak.admin.dto';
import {
  KeycloakJwtTokenDto,
  KeycloakJwtTokenRealmAccess,
  KeycloakJwtTokenResourceAccess,
} from 'apps/keycloak/src/keycloak.dto';
import { SermasBaseDto } from 'libs/sermas/sermas.dto';

export class AuthJwtUser extends KeycloakJwtTokenDto {
  @ApiProperty()
  exp: number;
  @ApiProperty()
  iat: number;
  @ApiProperty()
  auth_time: number;
  @ApiProperty()
  jti: string;
  @ApiProperty()
  iss: string;
  @ApiProperty()
  aud: string;
  @ApiProperty()
  sub: string;
  @ApiProperty()
  typ: string;
  @ApiProperty()
  azp: string;
  @ApiProperty()
  nonce: string;
  @ApiProperty()
  session_state: string;
  @ApiProperty()
  acr: string;
  @ApiProperty()
  scope: string;
  @ApiProperty()
  sid: string;
  @ApiProperty()
  email_verified: boolean;
  @ApiProperty()
  name: string;
  @ApiProperty()
  preferred_username: string;
  @ApiProperty()
  given_name: string;
  @ApiProperty()
  family_name: string;
  @ApiProperty()
  email: string;
  @ApiProperty({ type: KeycloakJwtTokenResourceAccess })
  realm_access: KeycloakJwtTokenRealmAccess;
  @ApiProperty({ type: KeycloakJwtTokenResourceAccess })
  resource_access: KeycloakJwtTokenResourceAccess;
  @ApiProperty()
  role: string;
  @ApiProperty()
  appId: string[];
  @ApiProperty()
  roles: string[];
}

export class AuthorizationUser {
  @ApiProperty()
  moduleId: string;
  @ApiProperty({ type: [String] })
  resource: string[];
  @ApiProperty({ type: [String] })
  scopes: string[];
}

export class LoginRequestDto extends SermasBaseDto {
  @ApiProperty()
  username: string;
  @ApiProperty()
  password: string;
}

export class RefreshTokenRequestDto extends SermasBaseDto {
  @ApiProperty()
  refreshToken: string;
  @ApiPropertyOptional()
  clientSecret?: string;
}

export class LoginResponseDto extends KeycloakTokenDto {
  @ApiProperty()
  access_token: string;
  @ApiProperty()
  expires_in: number;
  @ApiProperty()
  refresh_expires_in: number;
  @ApiProperty()
  refresh_token: string;
  @ApiProperty()
  token_type: string;
  'not-before-policy': number;
  @ApiProperty()
  session_state: string;
  @ApiProperty()
  scope: string;
}

export class RegistrationRequestDto extends SermasBaseDto {
  @ApiPropertyOptional()
  firstName: string;
  @ApiPropertyOptional()
  lastName: string;
  @ApiProperty()
  username: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  password: string;
}

export class RegistrationResponseDto {
  @ApiProperty()
  userId: string;
}

export class UpdateUserRequestDto extends SermasBaseDto {
  @ApiProperty()
  userId: string;
  @ApiPropertyOptional()
  password?: string;
  @ApiPropertyOptional()
  roles?: string;
  @ApiPropertyOptional()
  enabled?: boolean;
  @ApiPropertyOptional({ type: [AuthorizationUser] })
  authorization?: AuthorizationUser[];
}

export class UpdateUserEventDto extends SermasBaseDto {
  @ApiProperty()
  userId: string;
  @ApiProperty()
  enabled: boolean;
}
