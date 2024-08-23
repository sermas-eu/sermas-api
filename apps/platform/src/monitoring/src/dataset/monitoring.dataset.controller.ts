import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import {
  DatasetRecordDto,
  DatasetRecordFilterDto,
  MonitoringRecordDto,
} from './monitoring.dataset.dto';
import { MonitoringDatasetService } from './monitoring.dataset.service';

@ApiBearerAuth()
@Controller('platform/monitoring')
@ApiTags('PLATFORM')
@ApiResource('platform')
export class MonitoringDatasetController {
  constructor(private readonly datalogger: MonitoringDatasetService) {}

  @Post()
  @ApiScopes('monitoring')
  @ApiOperationName()
  monitoringAdd(
    @AuthenticatedUser() user: AuthJwtUser,
    @Body() record?: DatasetRecordDto,
  ) {
    if (!record.appId) throw new BadRequestException(`Missing appId`);
    if (!record.sessionId) throw new BadRequestException(`Missing sessionId`);
    if (!record.label) throw new BadRequestException(`Missing label`);
    if (!record.type) throw new BadRequestException(`Missing type`);

    return this.datalogger.save(record.label, record, record.type);
  }

  @Post('search')
  @ApiScopes('monitoring')
  @ApiOkResponse({
    type: [MonitoringRecordDto],
  })
  @ApiOperationName()
  async monitoringSearch(
    @AuthenticatedUser() user: AuthJwtUser,
    @Body() filter?: DatasetRecordFilterDto,
  ): Promise<MonitoringRecordDto[]> {
    if (!filter.appId) throw new BadRequestException(`Missing appId`);
    if (!filter.sessionId) throw new BadRequestException(`Missing sessionId`);
    return await this.datalogger.search(filter);
  }
}
