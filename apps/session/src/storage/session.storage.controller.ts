import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import {
  SessionStorageRecordDto,
  SessionStorageSearchDto,
} from './session.storage.dto';
import { SessionStorageService } from './session.storage.service';

@ApiBearerAuth()
@Controller('session')
@ApiResource('session')
@ApiTags('SESSION')
export class SessionStorageController {
  constructor(private readonly storage: SessionStorageService) {}

  @Post('storage')
  @ApiOkResponse({
    description: 'Record stored',
    type: SessionStorageRecordDto,
  })
  @ApiBody({ type: SessionStorageRecordDto })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiScopes('storage')
  @ApiOperationName({
    description: 'Store user data',
  })
  setRecord(
    @Body() data: SessionStorageRecordDto,
    @AuthenticatedUser() user?: AuthJwtUser,
  ): Promise<SessionStorageRecordDto> {
    return this.storage.set(data);
  }

  @Post('storage/search')
  @ApiOkResponse({
    description: 'Record stored',
    type: SessionStorageRecordDto,
    isArray: true,
  })
  @ApiBody({ type: SessionStorageSearchDto })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiScopes('storage')
  @ApiOperationName({
    description: 'Store user data',
  })
  findRecords(
    @Body() data: SessionStorageSearchDto,
    @AuthenticatedUser() user?: AuthJwtUser,
  ): Promise<SessionStorageRecordDto[]> {
    return this.storage.search(data);
  }

  @Get('storage/:storageId')
  @ApiOkResponse({
    description: 'Record retrieved',
    type: SessionStorageRecordDto,
  })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiScopes('storage')
  @ApiOperationName({
    description: 'Retrieve stored data',
  })
  getRecord(
    @Param('storageId') storageId: string,
    @AuthenticatedUser() user?: AuthJwtUser,
  ): Promise<SessionStorageRecordDto> {
    return this.storage.get(storageId);
  }

  @Delete('storage/:storageId')
  @ApiOkResponse({
    description: 'Record deleted',
  })
  @ApiUnauthorizedResponse()
  @ApiScopes('storage')
  @ApiOperationName({
    description: 'Delete a record',
  })
  deleteRecord(
    @Param('storageId') storageId: string,
    @AuthenticatedUser() user?: AuthJwtUser,
  ): Promise<void> {
    return this.storage.del(storageId, user?.sub);
  }
}
