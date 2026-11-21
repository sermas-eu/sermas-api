import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { PlatformAuthService } from '#apps/platform/src/auth/platform.auth.service';
import { ApiResource, ApiScopes } from '#libs/decorator/openapi.decorator';
import { AuthenticatedUser } from '#libs/auth/auth.decorators';
import { XRMarkerDto, XRMarkerListRequestDto } from './xr.marker.dto.js';
import { XrMarkerService } from './xr.marker.service.js';

@ApiBearerAuth()
@Controller('xr/marker')
@ApiResource('xr')
@ApiTags('XR')
export class XRMarkerController {
  constructor(
    private readonly marker: XrMarkerService,
    private readonly auth: PlatformAuthService,
  ) {}

  @Post('search')
  @ApiOkResponse({
    description: 'Marker created or updated',
    type: [XRMarkerDto],
  })
  @ApiUnauthorizedResponse()
  @ApiScopes('marker')
  @ApiOperation({
    description: 'List available markers',
  })
  searchMarker(
    @Body() payload: XRMarkerListRequestDto,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ): Promise<XRMarkerDto[]> {
    return this.marker.search(payload, user);
  }

  @Put()
  @ApiOkResponse({
    description: 'Marker saved',
    type: XRMarkerDto,
  })
  @ApiUnauthorizedResponse()
  @ApiScopes('marker')
  @ApiOperation({
    description: 'Save a marker',
  })
  async saveMarker(
    @Body() payload: XRMarkerDto,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ): Promise<XRMarkerDto> {
    if (!payload?.appId) throw new BadRequestException('Missing appId');
    await this.auth.assertAppAccess(user, payload.appId);
    // an existing marker may only be replaced by its own app
    if (payload.markerId) {
      const existing = await this.marker
        .read(payload.markerId)
        .catch(() => null);
      if (existing) await this.auth.assertAppAccess(user, existing.appId);
    }
    return this.marker.save(payload, user);
  }

  @Delete(':markerId')
  @ApiOkResponse({
    description: 'Marker deleted',
    type: XRMarkerDto,
  })
  @ApiUnauthorizedResponse()
  @ApiScopes('marker')
  @ApiOperation({
    description: 'Delete a marker',
  })
  async deleteMarker(
    @Param('markerId') markerId: string,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ): Promise<void> {
    const existing = await this.marker.read(markerId).catch(() => null);
    if (!existing) return;
    await this.auth.assertAppAccess(user, existing.appId);
    return this.marker.remove(markerId);
  }

  @Get(':markerId')
  @ApiScopes('marker')
  @ApiUnauthorizedResponse()
  @ApiOperation({
    description: 'Get the marker QR code as image (jpeg)',
  })
  @ApiOkResponse({
    description: 'Marker retrieved',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiProduces('image/jpeg')
  async getMarkerQRCode(
    @Param('markerId') markerId: string,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ) {
    const marker = await this.marker.read(markerId);
    await this.auth.assertAppAccess(user, marker.appId);
    return marker;
  }
}
