import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PlatformAuthService } from '#apps/platform/src/auth/platform.auth.service';
import type { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { ApiResource, ApiScopes } from '#libs/decorator/openapi.decorator';
import { ApiOperationName } from '#libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser } from '#libs/auth/auth.decorators';
import { AppModuleConfigDto } from '../platform.app.dto.js';
import { PlatformAppModuleService } from './app.mod.service.js';

@ApiBearerAuth()
@Controller('platform/app/:appId/module')
@ApiResource('platform')
@ApiTags('PLATFORM')
export class PlatformAppModuleController {
  constructor(
    private readonly module: PlatformAppModuleService,
    private readonly auth: PlatformAuthService,
  ) {}

  @Post()
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('module')
  @ApiOperationName({
    description: 'Create or update an app module',
  })
  async saveAppModule(
    @Param('appId') appId: string,
    @Body() data: AppModuleConfigDto,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ) {
    await this.auth.assertAppManager(user, appId);
    return this.module.saveModule(appId, data, user);
  }

  @Get(':moduleId')
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('module')
  @ApiOperationName({
    description: 'Retrieve an app module',
  })
  async getAppModule(
    @Param('appId') appId: string,
    @Param('moduleId') moduleId: string,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ) {
    await this.auth.assertAppManager(user, appId);
    return this.module.getModule(appId, moduleId, user);
  }

  @Delete(':moduleId')
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('module')
  @ApiOperationName({
    description: 'Remove an app module',
  })
  async removeAppModule(
    @Param('appId') appId: string,
    @Param('moduleId') moduleId: string,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ) {
    await this.auth.assertAppManager(user, appId);
    return this.module.removeModule(appId, moduleId, user);
  }
}
