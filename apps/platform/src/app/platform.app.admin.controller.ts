import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Query,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { AdminRole } from 'libs/decorator/admin-role.decorator';
import { ApiScopeAdmin } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { Resource } from 'nest-keycloak-connect';
import { PlatformAppDto, PlatformAppExportFilterDto } from './platform.app.dto';

@ApiBearerAuth()
@ApiTags('PLATFORM')
@Resource('platform')
@AdminRole()
@Controller('app/admin')
export class PlatformAppAdminController {
  constructor(private readonly platformAppService: PlatformAppService) {}

  @Post('import')
  @ApiScopeAdmin('app')
  @ApiOkResponse({
    type: PlatformAppDto,
    isArray: true,
  })
  @ApiBadRequestResponse()
  @ApiOperationName({
    summary: 'Batch import of applications',
  })
  @ApiBody({
    type: [PlatformAppDto],
  })
  importApps(
    @Body() payload: PlatformAppDto[],
    @Query('skipClients') skipClientsFlag?: string,
  ): Promise<PlatformAppDto[]> {
    const skipClients =
      skipClientsFlag === undefined ||
      skipClientsFlag === 'false' ||
      skipClientsFlag === '0' ||
      skipClientsFlag === ''
        ? false
        : true;
    return this.platformAppService.importApps(payload, skipClients);
  }

  @Post('export')
  @ApiScopeAdmin('app')
  @ApiOkResponse({
    type: PlatformAppDto,
    isArray: true,
  })
  @ApiBadRequestResponse()
  @ApiOperationName({
    summary: 'Batch export applications',
  })
  @ApiBody({
    type: PlatformAppExportFilterDto,
  })
  exportApps(
    @Body() filter: PlatformAppExportFilterDto,
  ): Promise<PlatformAppDto[]> {
    return this.platformAppService.exportApps(filter);
  }

  @Post('remove')
  @ApiScopeAdmin('app')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  @ApiOperationName({
    summary: 'Remove applications',
  })
  @ApiBody({
    type: PlatformAppExportFilterDto,
  })
  removeApps(@Body() filter: PlatformAppExportFilterDto) {
    if (!filter.name && (!filter.appId || !filter.appId.length))
      throw new BadRequestException();
    return this.platformAppService.removeApps(filter);
  }
}
