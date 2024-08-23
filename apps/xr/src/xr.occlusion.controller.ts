import { Controller, Get, NotImplementedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { XROcclusionResponseDto } from './xr.occlusion.dto';

@ApiBearerAuth()
@Controller('xr')
@ApiResource('xr')
@ApiTags('XR')
export class XROcclusionController {
  @Get('occlusion')
  @ApiResponse({
    status: 200,
    description: 'Got information about 3D model',
    type: XROcclusionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiScopes('occlusion')
  @ApiOperation({
    description:
      'Indicate if a 3D asset model is occluded by a physical obstacle.',
  })
  occlusion(
    @AuthenticatedUser()
    user?: any,
  ): Promise<XROcclusionResponseDto> {
    throw new NotImplementedException();
  }
}
