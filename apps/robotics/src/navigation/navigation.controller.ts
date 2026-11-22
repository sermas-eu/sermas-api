import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from '#libs/decorator/openapi.decorator';
import { NavigationSpaceDto } from './navigation.dto.js';
import { NavigationService } from './navigation.service.js';
import { StatusDto } from '../robotics.dto.js';

@ApiBearerAuth()
@Controller('robotics/navigation')
@ApiTags('ROBOTICS')
@ApiResource('robotics')
export class NavigationController {
  constructor(private readonly navigation: NavigationService) {}

  @Post(':appId')
  @ApiScopes('navigation')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  save(@Param('appId') appId: string, @Body() space: NavigationSpaceDto) {
    if (!space?.spaceId) throw new BadRequestException('Missing spaceId');
    // the guard checked appId; spaces are kept per app
    return this.navigation.save(appId, { ...space, appId });
  }

  @Delete(':appId/:spaceId')
  @ApiScopes('navigation')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  remove(@Param('appId') appId: string, @Param('spaceId') spaceId: string) {
    return this.navigation.remove(appId, spaceId);
  }

  @Get(':appId/:spaceId')
  @ApiScopes('navigation')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  getById(
    @Param('appId') appId: string,
    @Param('spaceId') spaceId: string,
  ): Promise<NavigationSpaceDto | null> {
    return this.navigation.getById(spaceId, appId);
  }

  @Get(':appId/status/:robotId')
  @ApiScopes('navigation')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  getStatus(
    @Param('appId') appId: string,
    @Param('robotId') robotId: string,
  ): Promise<StatusDto | null> {
    return this.navigation.getStatus(appId, robotId);
  }
}
