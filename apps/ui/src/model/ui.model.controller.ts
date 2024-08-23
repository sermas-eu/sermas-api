import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import {
  UIModelMapBlendShapesRequestDto,
  UIModelMapBlendShapesResponseDto,
} from './ui.model.dto';
import { UIModelService } from './ui.model.service';

@ApiBearerAuth()
@Controller('ui/model')
@ApiResource('ui/model')
@ApiTags('UI')
export class UIModelController {
  constructor(private readonly model: UIModelService) {}

  @Post('map-blend-shapes')
  @ApiResponse({
    status: 200,
    description: 'Map model blend shapes',
    type: UIModelMapBlendShapesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'unauthorized',
  })
  @ApiScopes('assets')
  @ApiOperation({
    description: 'Tries to map model blend shapes by name similarity',
  })
  mapBlendShapes(
    @Body() data: UIModelMapBlendShapesRequestDto,
    @AuthenticatedUser()
    user?: any,
  ): Promise<UIModelMapBlendShapesResponseDto> {
    return this.model.mapBlendShapes(data);
  }
}
