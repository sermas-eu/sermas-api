import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PlatformAuthService } from '#apps/platform/src/auth/platform.auth.service';
import type { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { AuthenticatedUser } from '#libs/auth/auth.decorators';
import { ApiResource, ApiScopes } from '#libs/decorator/openapi.decorator';
import { AppClientDto } from '../platform.app.dto.js';
import { PlatformAppClientService } from './platform.client.service.js';
import { ApiOperationName } from '#libs/decorator/openapi.operation.decorator';

@ApiBearerAuth()
@ApiTags('PLATFORM')
@ApiResource('platform')
@Controller('platform/app/:appId/client')
export class PlatformAppClientController {
  constructor(
    private readonly client: PlatformAppClientService,
    private readonly auth: PlatformAuthService,
  ) {}

  @Post()
  @ApiScopes('client')
  @ApiOkResponse({
    type: AppClientDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  async createClient(
    @Param('appId') appId: string,
    @Body() payload: AppClientDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<AppClientDto> {
    await this.auth.assertAppManager(user, appId);
    payload.appId = appId;
    return this.client.createClient(payload);
  }

  @Get(':clientId')
  @ApiScopes('client')
  @ApiOkResponse({
    type: AppClientDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  async readClient(
    @Param('appId') appId: string,
    @Param('clientId') clientId: string,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<AppClientDto> {
    // the answer carries the client secret
    await this.auth.assertAppManager(user, appId);
    return this.client.readClient(appId, clientId);
  }

  @Get(':clientId/topics')
  @ApiScopes('client')
  @ApiOkResponse({
    type: String,
    isArray: true,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  async listTopics(
    @Param('appId') appId: string,
    @Param('clientId') clientId: string,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<string[]> {
    // the app's own clients read their topics to subscribe (the guard checked
    // app access); no secret here
    await this.auth.assertAppAccess(user, appId);
    return this.client.listTopics(appId, clientId);
  }

  @Delete(':clientId')
  @ApiScopes('client')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  @ApiOperationName()
  async removeClient(
    @Param('clientId') clientId: string,
    @Param('appId') appId: string,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<void> {
    await this.auth.assertAppManager(user, appId);
    return this.client.removeClient(appId, clientId);
  }
}
