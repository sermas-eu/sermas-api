import {
  BadRequestException,
  Body,
  ForbiddenException,
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
import { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { PlatformAppService } from '#apps/platform/src/app/platform.app.service';
import { PlatformAuthService } from '#apps/platform/src/auth/platform.auth.service';
import { ApiResource, ApiScopes } from '#libs/decorator/openapi.decorator';
import { ApiOperationName } from '#libs/decorator/openapi.operation.decorator';
import {
  AuthenticatedUser,
  CreatesApp,
  Public,
} from '#libs/auth/auth.decorators';
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
} from './platform.app.dto.js';

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
  constructor(
    private readonly platformAppService: PlatformAppService,
    private readonly auth: PlatformAuthService,
  ) {}

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
  @CreatesApp()
  createApp(
    @Body() payload: CreatePlatformAppDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<PlatformAppDto> {
    // users create apps for themselves; admins and system accounts for anyone
    const data = { ...payload };
    if (!this.auth.isSystemClient(user) && !this.auth.isPlatformAdmin(user))
      data.ownerId = user.sub;
    return this.platformAppService.createApp({ data });
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
  async updateApp(
    @Body() payload: PlatformAppDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<PlatformAppDto> {
    if (!payload?.appId) throw new BadRequestException('Missing appId');
    await this.auth.assertAppManager(user, payload.appId);
    // handing the app to another owner is for admins
    if (
      payload.ownerId &&
      !this.auth.isSystemClient(user) &&
      !this.auth.isPlatformAdmin(user)
    ) {
      const current = await this.platformAppService.readApp(payload.appId);
      if (payload.ownerId !== current.ownerId)
        throw new ForbiddenException('Only admins change the owner');
    }
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
    @AuthenticatedUser() user: AuthJwtUser,
  ) {
    await this.auth.assertAppManager(user, appId);
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
    @AuthenticatedUser() user: AuthJwtUser,
  ) {
    await this.auth.assertAppManager(user, appId);
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
  async removeApp(
    @Param('appId') appId: string,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<void> {
    await this.auth.assertAppManager(user, appId);
    return this.platformAppService.removeApp(appId);
  }
}
