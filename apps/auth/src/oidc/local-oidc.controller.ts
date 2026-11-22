import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { KeycloakService } from '#apps/keycloak/src/keycloak.service';
import { LocalKeycloakService } from '#apps/keycloak/src/local/local-keycloak.service';
import { Public } from '#libs/auth/auth.decorators';
import { getLocalJwks } from '#libs/auth/local/local-auth';

type TokenForm = {
  grant_type?: string;
  client_id?: string;
  client_secret?: string;
  username?: string;
  password?: string;
  refresh_token?: string;
};

/** an OAuth 2 error response: `{ "error": "<code>" }` */
class OAuthError extends HttpException {
  constructor(status: number, error: string) {
    super({ error }, status);
  }
}

const oauthError = (status: number, error: string) =>
  new OAuthError(status, error);

/**
 * AUTH_PROVIDER=local: the part of a Keycloak realm's OpenID Connect endpoints
 * that SERMAS clients call (the kiosk server's client_credentials login through
 * the node SDK, the CLI's password login, JWKS). Point AUTH_URL-style settings
 * (PUBLIC_AUTH_URL, AUTH_KEYCLOAK_URL) at `<api>/api/auth/oidc`. With Keycloak
 * in use every route answers 404.
 */
@ApiExcludeController()
@Public()
@Controller('auth/oidc/realms/:realm')
export class LocalOidcController {
  constructor(private readonly keycloak: KeycloakService) {}

  private local(realm: string): LocalKeycloakService {
    const local = this.keycloak as unknown;
    if (!(local instanceof LocalKeycloakService) || realm !== local.getRealm())
      throw new NotFoundException();
    return local;
  }

  @Get('.well-known/openid-configuration')
  discovery(@Param('realm') realm: string) {
    const issuer = this.local(realm).getIssuer();
    return {
      issuer,
      token_endpoint: `${issuer}/protocol/openid-connect/token`,
      jwks_uri: `${issuer}/protocol/openid-connect/certs`,
      grant_types_supported: [
        'password',
        'client_credentials',
        'refresh_token',
      ],
      token_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic',
      ],
      id_token_signing_alg_values_supported: ['RS256'],
    };
  }

  @Get('protocol/openid-connect/certs')
  certs(@Param('realm') realm: string) {
    this.local(realm);
    return getLocalJwks();
  }

  @Post('protocol/openid-connect/token')
  @HttpCode(200)
  async token(
    @Param('realm') realm: string,
    @Body() form: TokenForm,
    @Headers('authorization') authorization?: string,
  ) {
    const local = this.local(realm);
    form = form || {};
    let clientId = form.client_id;
    let clientSecret = form.client_secret;
    if (authorization?.startsWith('Basic ')) {
      const decoded = Buffer.from(authorization.slice(6), 'base64').toString();
      const i = decoded.indexOf(':');
      if (i > 0) {
        clientId = decodeURIComponent(decoded.slice(0, i));
        clientSecret = decodeURIComponent(decoded.slice(i + 1));
      }
    }
    if (!clientId) throw oauthError(400, 'invalid_request');

    try {
      switch (form.grant_type) {
        case 'client_credentials':
          // the platform client is the API's own: its tokens are admin tokens,
          // and its secret may be a default
          if (clientId === local.getPlatformClientName())
            throw oauthError(400, 'unauthorized_client');
          return await local.getClientAccessToken({ clientId, clientSecret });
        case 'password': {
          // the client must be one users log in through, with its secret if any
          const client = await local.getClientByName(clientId);
          if (!client) throw oauthError(401, 'invalid_client');
          // users log in through the platform client (public here: the admin
          // password is the check, as in POST /api/auth/login) or an app's
          // login client
          if (
            clientId !== local.getPlatformClientName() &&
            !clientId.endsWith('-application')
          ) {
            throw oauthError(400, 'unauthorized_client');
          }
          return await local.login(form.username, form.password, clientId);
        }
        case 'refresh_token':
          return await local.getClientRefreshToken({
            clientId,
            refreshToken: form.refresh_token,
          });
        default:
          throw oauthError(400, 'unsupported_grant_type');
      }
    } catch (e: any) {
      if (e instanceof OAuthError) throw e;
      throw oauthError(
        401,
        form.grant_type === 'client_credentials'
          ? 'invalid_client'
          : 'invalid_grant',
      );
    }
  }
}
