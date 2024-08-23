import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientLoginDto } from 'apps/keycloak/src/keycloak.dto';
import { KeycloakService } from 'apps/keycloak/src/keycloak.service';
import { getKeycloakClientId } from 'apps/keycloak/src/util';
import { PlatformAuthService } from './platform.auth.service';
import { PlatformTokenAsyncApiService } from './platform.token.async.service';
import {
  AccessTokenRequestDto,
  JwtTokenDto,
  PlatformTokenDto,
  RefreshTokenRequestDto,
} from './platform.token.dto';

@Injectable()
export class PlatformAuthTokenService {
  private readonly logger = new Logger(PlatformAuthTokenService.name);
  constructor(
    private readonly keycloak: KeycloakService,
    private readonly asyncApi: PlatformTokenAsyncApiService,
    private readonly auth: PlatformAuthService,
  ) {}

  async getClientAccessToken(req: AccessTokenRequestDto, bearerToken?: string) {
    if (!req.appId) throw new BadRequestException('appId missing');
    if (!req.clientId) throw new BadRequestException('appId missing');

    if (!req.clientSecret && !bearerToken)
      throw new BadRequestException(
        'One of clientSecret or bearer token is required',
      );

    const accessTokenPayload: ClientLoginDto = {
      clientId: getKeycloakClientId(req.appId, req.clientId),
      clientSecret: req.clientSecret,
    };

    if (bearerToken) {
      const jwt = this.auth.parseToken(bearerToken);
      if (jwt === null)
        throw new BadRequestException(`Failed to parse bearer token`);

      const isAllowed = await this.auth.isAllowed({
        appId: req.appId,
        clientId: req.clientId,
        resource: 'platform',
        scopes: ['token'],
        token: bearerToken,
        userId: jwt.sub,
      });

      if (!isAllowed) throw new ForbiddenException();

      if (!accessTokenPayload.clientSecret) {
        const client = await this.keycloak.getClientByName(
          getKeycloakClientId(req.appId, req.clientId),
        );
        if (!client)
          throw new NotFoundException(`Client ${req.clientId} not found`);
        try {
          const credentials = await this.keycloak.getClientCredentials(
            client.id,
          );
          accessTokenPayload.clientId = client.clientId;
          accessTokenPayload.clientSecret = credentials.value;
        } catch (e: any) {
          this.logger.warn(`Failed to load client credentials: ${e.message}`);
          throw new InternalServerErrorException('Failed to load client');
        }
      }
    }

    try {
      const token =
        await this.keycloak.getClientAccessToken(accessTokenPayload);

      const ev: PlatformTokenDto = {
        appId: req.appId,
        clientId: getKeycloakClientId(req.appId, req.clientId),
        ts: new Date(),
        tokenType: 'access',
      };
      this.asyncApi.tokenRequested(ev);

      return token;
    } catch (e: any) {
      if (e.stack.toString().indexOf('status code 401')) {
        this.logger.debug(
          `Unauthorized client=${req.clientId} appId=${req.appId}`,
        );
        throw new UnauthorizedException();
      }
      this.logger.warn(`Failed to get client access token: ${e.stack}`);
      throw new InternalServerErrorException();
    }
  }

  async getClientRefreshToken(
    req: RefreshTokenRequestDto,
  ): Promise<JwtTokenDto> {
    if (!req.appId) throw new BadRequestException('appId missing');
    if (!req.clientId) throw new BadRequestException('clientId missing');

    const client = await this.keycloak.getClientByName(
      getKeycloakClientId(req.appId, req.clientId),
    );
    if (!client) throw new NotFoundException('client not found');

    if (
      !req.refreshToken &&
      req.clientSecret &&
      client.clientAuthenticatorType === 'client-secret'
    ) {
      return await this.getClientAccessToken(req);
    }

    if (!req.refreshToken) {
      throw new BadRequestException('refreshToken missing');
    }

    const token = await this.keycloak.getClientRefreshToken({
      clientId: client.clientId,
      refreshToken: req.refreshToken,
      accessToken: req.accessToken,
    });

    const ev: PlatformTokenDto = {
      appId: req.appId,
      clientId: req.clientId,
      ts: new Date(),
      tokenType: 'refresh',
    };
    this.asyncApi.tokenRequested(ev);

    return token;
  }
}
