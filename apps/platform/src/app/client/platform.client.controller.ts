import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { AppClientDto } from '../platform.app.dto';
import { PlatformAppClientService } from './platform.client.service';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';

@ApiBearerAuth()
@ApiTags('PLATFORM')
@ApiResource('platform')
@Controller('platform/app/:appId/client')
export class PlatformAppClientController {
  constructor(private readonly client: PlatformAppClientService) {}

  @Post()
  @ApiScopes('client')
  @ApiOkResponse({
    type: AppClientDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  createClient(
    @Param('appId') appId: string,
    @Body() payload: AppClientDto,
  ): Promise<AppClientDto> {
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
  readClient(
    @Param('appId') appId: string,
    @Param('clientId') clientId: string,
  ): Promise<AppClientDto> {
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
  listTopics(
    @Param('appId') appId: string,
    @Param('clientId') clientId: string,
  ): Promise<string[]> {
    return this.client.listTopics(appId, clientId);
  }

  @Delete(':clientId')
  @ApiScopes('client')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  @ApiOperationName()
  removeClient(
    @Param('clientId') clientId: string,
    @Param('appId') appId: string,
  ): Promise<void> {
    return this.client.removeClient(appId, clientId);
  }
}
