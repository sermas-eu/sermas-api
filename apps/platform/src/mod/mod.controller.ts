import {
  Body,
  Controller,
  Delete,
  Get,
  Head,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { PlatformAuthService } from '#apps/platform/src/auth/platform.auth.service';
import { ApiResource, ApiScopes } from '#libs/decorator/openapi.decorator';
import { ApiOperationName } from '#libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser } from '#libs/auth/auth.decorators';
import { PlatformModuleConfigDto } from './mod.dto.js';
import { PlatformModuleService } from './mod.service.js';

@ApiBearerAuth()
@Controller('platform/module')
@ApiResource('platform')
@ApiTags('PLATFORM')
export class PlatformModuleController {
  constructor(
    private readonly module: PlatformModuleService,
    private readonly auth: PlatformAuthService,
  ) {}

  // platform modules serve every app and carry their secret: admins and system
  // service accounts only

  @Post()
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('module')
  @ApiOperationName({
    description: 'Create or update an app module',
  })
  @ApiBody({
    type: PlatformModuleConfigDto,
  })
  savePlatformModule(
    @Body() data: PlatformModuleConfigDto,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ) {
    this.auth.assertPlatformAdmin(user);
    return this.module.register(data, user);
  }

  @Head(':moduleId')
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('module')
  @ApiOperationName({
    description: 'reload app module specs',
  })
  refreshPlatformModule(
    @Param('moduleId') moduleId: string,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ) {
    this.auth.assertPlatformAdmin(user);
    return this.module.reload(moduleId, user);
  }

  @Get(':moduleId')
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('module')
  @ApiOperationName({
    description: 'Retrieve an app module',
  })
  getPlatformModule(
    @Param('moduleId') moduleId: string,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ) {
    this.auth.assertPlatformAdmin(user);
    return this.module.get(moduleId, user);
  }

  @Delete(':moduleId')
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('module')
  @ApiOperationName({
    description: 'Remove an app module',
  })
  removePlatformModule(
    @Param('moduleId') moduleId: string,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ) {
    this.auth.assertPlatformAdmin(user);
    return this.module.remove(moduleId, user);
  }
}
