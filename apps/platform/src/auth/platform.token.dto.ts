import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SermasBaseDto } from 'libs/sermas/sermas.dto';
import { KeycloakTokenDto } from 'apps/keycloak/src/keycloak.admin.dto';

export class PlatformTokenDto extends SermasBaseDto {
  tokenType: 'access' | 'refresh';
}

export class JwtTokenDto extends KeycloakTokenDto {
  @ApiProperty()
  access_token: string;
  @ApiProperty()
  expires_in: number;
  @ApiProperty()
  refresh_expires_in: number;
  @ApiProperty()
  refresh_token?: string;
  @ApiProperty()
  token_type: string;
  @ApiProperty()
  id_token?: string;
  @ApiProperty()
  'not-before-policy': number;
  @ApiProperty()
  session_state: string;
  @ApiProperty()
  scope: string;
}

export class AppTokenRequestDto extends SermasBaseDto {
  @ApiProperty()
  appId: string;
  @ApiProperty()
  clientId: string;
  @ApiProperty()
  clientSecret: string;
}

export class AccessTokenRequestDto {
  @ApiPropertyOptional()
  appId?: string;
  @ApiProperty()
  clientId: string;
  @ApiPropertyOptional()
  clientSecret?: string;
}

export class RefreshTokenRequestDto extends AccessTokenRequestDto {
  @ApiProperty()
  refreshToken: string;
  @ApiProperty()
  clientId: string;
  @ApiPropertyOptional()
  accessToken?: string;
}
