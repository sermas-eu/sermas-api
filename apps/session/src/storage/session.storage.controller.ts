import { PlatformAuthService } from '#apps/platform/src/auth/platform.auth.service';
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { ApiResource, ApiScopes } from '#libs/decorator/openapi.decorator';
import { ApiOperationName } from '#libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser } from '#libs/auth/auth.decorators';
import {
  SessionStorageRecordDto,
  SessionStorageSearchDto,
} from './session.storage.dto.js';
import { SessionStorageService } from './session.storage.service.js';

@ApiBearerAuth()
@Controller('session')
@ApiResource('session')
@ApiTags('SESSION')
export class SessionStorageController {
  constructor(
    private readonly storage: SessionStorageService,
    private readonly auth: PlatformAuthService,
  ) {}

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
  async setRecord(
    @Body() data: SessionStorageRecordDto,
    @AuthenticatedUser() user?: AuthJwtUser,
  ): Promise<SessionStorageRecordDto> {
    // records are looked up within data.appId, which the guard checked
    if (data?.appId) await this.auth.assertAppAccess(user, data.appId);
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
  async findRecords(
    @Body() data: SessionStorageSearchDto,
    @AuthenticatedUser() user?: AuthJwtUser,
  ): Promise<SessionStorageRecordDto[]> {
    const records = await this.storage.search(data);
    // a search by sessionId alone may match other apps' records
    const allowed = new Map<string, boolean>();
    for (const appId of new Set(records.map((r) => r.appId)))
      allowed.set(appId, await this.auth.canAccessApp(user, appId));
    return records.filter((r) => allowed.get(r.appId));
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
  async getRecord(
    @Param('storageId') storageId: string,
    @AuthenticatedUser() user?: AuthJwtUser,
  ): Promise<SessionStorageRecordDto> {
    const record = await this.storage.get(storageId);
    await this.auth.assertAppAccess(user, record.appId);
    return record;
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
  async deleteRecord(
    @Param('storageId') storageId: string,
    @AuthenticatedUser() user?: AuthJwtUser,
  ): Promise<void> {
    const record = await this.storage.get(storageId);
    await this.auth.assertAppAccess(user, record.appId);
    // by app access, not by `sub`: kiosk callers are a service account,
    // never the record's userId, so that filter never matched (D-36)
    return this.storage.del(storageId);
  }
}
