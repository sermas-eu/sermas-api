import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { AppModuleConfigDto } from '../platform.app.dto';
import { PlatformAppModuleService } from './app.mod.service';

@ApiBearerAuth()
@Controller('platform/app/:appId/module')
@ApiResource('platform')
@ApiTags('PLATFORM')
export class PlatformAppModuleController {
  constructor(private readonly module: PlatformAppModuleService) {}

  @Post()
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('module')
  @ApiOperationName({
    description: 'Create or update an app module',
  })
  saveAppModule(
    @Param('appId') appId: string,
    @Body() data: AppModuleConfigDto,
    @AuthenticatedUser()
    user?: any,
  ) {
    return this.module.saveModule(appId, data, user);
  }

  @Get(':moduleId')
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('module')
  @ApiOperationName({
    description: 'Retrieve an app module',
  })
  getAppModule(
    @Param('appId') appId: string,
    @Param('moduleId') moduleId: string,
    @AuthenticatedUser()
    user?: any,
  ) {
    return this.module.getModule(appId, moduleId, user);
  }

  @Delete(':moduleId')
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('module')
  @ApiOperationName({
    description: 'Remove an app module',
  })
  removeAppModule(
    @Param('appId') appId: string,
    @Param('moduleId') moduleId: string,
    @AuthenticatedUser()
    user?: any,
  ) {
    return this.module.removeModule(appId, moduleId, user);
  }
}
