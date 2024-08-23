import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
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
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { XRMarkerDto, XRMarkerListRequestDto } from './xr.marker.dto';
import { XrMarkerService } from './xr.marker.service';

@ApiBearerAuth()
@Controller('xr/marker')
@ApiResource('xr')
@ApiTags('XR')
export class XRMarkerController {
  constructor(private readonly marker: XrMarkerService) {}

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
  saveMarker(
    @Body() payload: XRMarkerDto,
    @AuthenticatedUser()
    user?: AuthJwtUser,
  ): Promise<XRMarkerDto> {
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
  deleteMarker(
    @Param(':markerId') markerId: string,
    @AuthenticatedUser()
    user?: any,
  ): Promise<void> {
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
    status: HttpStatus.OK,
  })
  @ApiProduces('image/jpeg')
  getMarkerQRCode(
    @Param(':markerId') markerId: string,
    @AuthenticatedUser()
    user?: any,
  ) {
    return this.marker.read(markerId);
  }
}
