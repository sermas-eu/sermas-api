import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { Public } from 'nest-keycloak-connect';
import {
  AccessTokenRequestDto,
  JwtTokenDto,
  RefreshTokenRequestDto,
} from './platform.token.dto';
import { PlatformAuthTokenService } from './platform.token.service';

@ApiBearerAuth()
@Controller('platform/token')
@ApiResource('platform')
@ApiTags('PLATFORM')
export class PlatformAuthTokenController {
  constructor(private readonly token: PlatformAuthTokenService) {}

  @Post(['/', 'access_token'])
  @ApiOkResponse({
    description: 'Request an access token for an app',
    type: JwtTokenDto,
  })
  @ApiUnauthorizedResponse()
  @ApiBadRequestResponse()
  @ApiScopes('token')
  @Public()
  @ApiOperationName()
  getClientAccessToken(
    @Body() payload: AccessTokenRequestDto,
    @Req() req: Request,
  ): Promise<JwtTokenDto> {
    return this.token.getClientAccessToken(payload, req.headers?.authorization);
  }

  @Post(['refresh', 'refresh_token'])
  @ApiOkResponse({
    description: 'Request a refresh access token for an app',
    type: JwtTokenDto,
  })
  @ApiUnauthorizedResponse()
  @ApiBadRequestResponse()
  @ApiBody({
    type: RefreshTokenRequestDto,
  })
  @ApiScopes('token')
  @ApiOperationName()
  getClientRefreshToken(
    @Body() data: RefreshTokenRequestDto,
    @Req() req: Request,
  ): Promise<JwtTokenDto> {
    const payload: RefreshTokenRequestDto = { ...data };
    if (req.headers.authorization) {
      payload.accessToken = req.headers.authorization.replace(/^Bearer /i, '');
    }
    return this.token.getClientRefreshToken(payload);
  }
}
