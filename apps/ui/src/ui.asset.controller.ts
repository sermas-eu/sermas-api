import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { Response } from 'express';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { ApiUpload } from 'libs/decorator/openapi.upload.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { UIAssetDto } from './ui.asset.dto';
import { UIAssetService } from './ui.asset.service';

@ApiBearerAuth()
@Controller('ui/asset')
@ApiResource('ui')
@ApiTags('UI')
@ApiExtraModels(UIAssetDto)
export class UIAssetController {
  constructor(private readonly assets: UIAssetService) {}

  @Get(':appId/:type/:assetId')
  @ApiOkResponse({
    description: 'Asset content',
    type: Buffer,
  })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiInternalServerErrorResponse()
  @ApiScopes('content')
  @ApiOperationName({
    summary: 'Retrieve an asset',
  })
  getAsset(
    @Param('appId') appId: string,
    @Param('type') type: string,
    @Param('assetId') assetId: string,
    @Res({ passthrough: true }) response: Response,
    @AuthenticatedUser()
    user?: any,
  ): Promise<StreamableFile> {
    return this.assets.getAsset({ appId, type, assetId, user });
  }

  @Post()
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiInternalServerErrorResponse()
  @ApiScopes('content')
  @ApiOperationName({
    summary: 'Retrieve an asset',
  })
  @ApiScopes('content')
  @ApiUpload(UIAssetDto, 'file')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  saveAsset(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: UIAssetDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<void> {
    return this.assets.saveAsset(data, file);
  }
}
