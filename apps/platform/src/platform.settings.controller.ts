import { Controller, Get } from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';
import { PlatformSettingsDto } from './platform.dto';
import { PlatformSettingsService } from './platform.settings.service';

@ApiBearerAuth()
@ApiTags('PLATFORM')
@Controller('platorm')
@ApiResource('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformSettingsService) {}

  @Get('topics/user')
  @ApiOkResponse({
    type: PlatformSettingsDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  @ApiUnauthorizedResponse()
  @ApiScopes('token')
  @ApiOperationName()
  getUserSettings(@AuthenticatedUser() user?: AuthJwtUser) {
    return this.platform.getSettings({
      user,
      filterByPermissions: true,
    });
  }

  @Get('topics')
  @ApiScopes('token')
  @Public()
  @ApiOkResponse({
    type: PlatformSettingsDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  getSettings() {
    return this.platform.getSettings({
      filterByPermissions: false,
    });
  }
}
