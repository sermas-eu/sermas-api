import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { AdminRole } from 'libs/decorator/admin-role.decorator';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiUpload } from 'libs/decorator/openapi.upload.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { UIAssetDto } from './ui.asset.dto';
import { UIAssetService } from './ui.asset.service';

@ApiBearerAuth()
@Controller('ui/admin')
@ApiResource('ui')
@ApiTags('UI')
@AdminRole()
export class UIAssetAdminController {
  constructor(private readonly assets: UIAssetService) {}

  @Post('asset')
  @ApiScopes('content')
  @ApiUpload(UIAssetDto, 'file')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  adminSaveAsset(
    @AuthenticatedUser() user: AuthJwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() data: UIAssetDto,
  ): Promise<void> {
    return this.assets.saveAsset(data, file);
  }
}
