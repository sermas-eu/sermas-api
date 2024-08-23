import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';
import {
  AppSettingsDto,
  AppToolsDTO,
  AppUserDto,
  CreatePlatformAppDto,
  PlatformAppDto,
  RepositoryAvatarDto,
  RepositoryBackgroundDto,
  RepositoryConfigDto,
  RepositoryRobotModelDto,
} from './platform.app.dto';

@ApiBearerAuth()
@ApiTags('PLATFORM')
@ApiResource('platform')
@Controller('app')
@ApiExtraModels(
  RepositoryConfigDto,
  RepositoryAvatarDto,
  RepositoryBackgroundDto,
  RepositoryRobotModelDto,
  AppUserDto,
  AppToolsDTO,
)
export class PlatformAppController {
  constructor(private readonly platformAppService: PlatformAppService) {}

  @Get('repository/defaults')
  @Public()
  @ApiScopes('app')
  @ApiOkResponse({
    type: RepositoryConfigDto,
  })
  @ApiOperationName({
    description: 'retrieve app repository defaults',
  })
  getRepositoryDefaults() {
    return this.platformAppService.getRepositoryDefaults();
  }

  @Get()
  @Public()
  @ApiScopes('app')
  @ApiOkResponse({
    type: PlatformAppDto,
    isArray: true,
  })
  listApps() {
    return this.platformAppService.listPublicApps();
  }

  @Post()
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse({
    type: PlatformAppDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  createApp(@Body() payload: CreatePlatformAppDto): Promise<PlatformAppDto> {
    return this.platformAppService.createApp({ data: payload });
  }

  @Get('list')
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse({
    type: PlatformAppDto,
    isArray: true,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  listUserApps(
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<PlatformAppDto[]> {
    return this.platformAppService.listUserApps(user.sub);
  }

  @Put()
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse({
    type: PlatformAppDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  updateApp(@Body() payload: PlatformAppDto): Promise<PlatformAppDto> {
    return this.platformAppService.updateApp({ data: payload });
  }

  @Put(':appId/tools')
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse()
  @ApiBody({
    type: [AppToolsDTO],
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  async updateAppTools(
    @Param('appId') appId: string,
    @Body() payload: AppToolsDTO[],
  ) {
    await this.platformAppService.updateAppTools(appId, payload);
  }

  @Put(':appId/settings')
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse()
  @ApiBody({
    type: [AppSettingsDto],
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  async updateAppSettings(
    @Param('appId') appId: string,
    @Body() payload: AppSettingsDto,
  ) {
    await this.platformAppService.updateAppSettings(appId, payload);
  }

  @Get(':appId/repository')
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse({
    type: RepositoryConfigDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  async getAppRepository(@Param('appId') appId: string) {
    await this.platformAppService.getAppRepository(appId);
  }

  @Get(':appId/repository/robots')
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse({
    type: RepositoryRobotModelDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  async getAppRepositoryRobots(
    @Param('appId') appId: string,
    @Query('name') name?: string,
  ) {
    await this.platformAppService.getAppRepository(appId, 'robots', name);
  }

  @Get(':appId/repository/avatars')
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse({
    type: RepositoryAvatarDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  async getAppRepositoryAvatars(
    @Param('appId') appId: string,
    @Query('name') name?: string,
  ) {
    await this.platformAppService.getAppRepository(appId, 'avatars', name);
  }

  @Get(':appId/repository/backgrounds')
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse({
    type: RepositoryConfigDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  async getAppRepositoryBackgrounds(
    @Param('appId') appId: string,
    @Query('name') name?: string,
  ) {
    await this.platformAppService.getAppRepository(appId, 'backgrounds', name);
  }

  @Get(':appId')
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse({
    type: PlatformAppDto,
  })
  @ApiBadRequestResponse()
  @ApiOperationName()
  readApp(@Param('appId') appId: string): Promise<PlatformAppDto> {
    return this.platformAppService.readApp(appId);
  }

  @Delete(':appId')
  @ApiScopes(['app', 'app:editor'])
  @ApiOkResponse()
  @ApiBadRequestResponse()
  @ApiOperationName()
  removeApp(@Param('appId') appId: string): Promise<void> {
    return this.platformAppService.removeApp(appId);
  }
}
