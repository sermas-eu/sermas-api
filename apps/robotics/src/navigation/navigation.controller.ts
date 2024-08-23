import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { NavigationSpaceDto } from './navigation.dto';
import { NavigationService } from './navigation.service';
import { StatusDto } from '../robotics.dto';

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
  save(space: NavigationSpaceDto) {
    return this.navigation.save(space);
  }

  @Delete(':appId/spaceId')
  @ApiScopes('navigation')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  remove(@Param('spaceId') spaceId: string) {
    return this.navigation.remove(spaceId);
  }

  @Get(':appId/:spaceId')
  @ApiScopes('navigation')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  getById(
    @Param('spaceId') spaceId: string,
  ): Promise<NavigationSpaceDto | null> {
    return this.navigation.getById(spaceId);
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
