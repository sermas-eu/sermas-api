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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { PlatformAuthService } from '#apps/platform/src/auth/platform.auth.service';
import { SessionService } from '#apps/session/src/session.service';
import { ApiResource, ApiScopes } from '#libs/decorator/openapi.decorator';
import { ApiOperationName } from '#libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser } from '#libs/auth/auth.decorators';
import { SessionDto, SessionSearchFilter } from './session.dto.js';

@ApiBearerAuth()
@Controller('session')
@ApiResource('session')
@ApiTags('SESSION')
export class SessionController {
  constructor(
    private session: SessionService,
    private auth: PlatformAuthService,
  ) {}

  /** The session, if it belongs to an app the caller may use. */
  private async readOwnSession(sessionId: string, user: AuthJwtUser) {
    if (!sessionId) throw new BadRequestException('Missing sessionId');
    const session = await this.session.read(sessionId);
    await this.auth.assertAppAccess(user, session.appId);
    return session;
  }

  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiScopes('session')
  @ApiOperationName({
    description: 'Load current user session',
  })
  @Get('user/:appId')
  getUserSession(
    @Param('appId') appId: string,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<SessionDto> {
    return this.session.getUserSession(appId, user.sub);
  }

  @ApiOkResponse({
    type: [SessionDto],
  })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @ApiScopes('session')
  @ApiOperationName({
    description: 'List recent sessions',
  })
  @Post('search/:appId')
  search(
    @Param('appId') appId: string,
    @Body() filter: SessionSearchFilter,
  ): Promise<SessionDto[]> {
    if (!appId) throw new BadRequestException('Missing appId');
    return this.session.search(appId, filter);
  }

  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @ApiScopes('session')
  @ApiOperationName({
    description: 'Load a session',
  })
  @Get(':sessionId')
  readSession(
    @Param('sessionId') sessionId: string,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<SessionDto> {
    return this.readOwnSession(sessionId, user);
  }

  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('session')
  @ApiOperationName({
    description: 'Remove session',
  })
  @Delete(':sessionId')
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<void> {
    await this.readOwnSession(sessionId, user);
    return this.session.delete(sessionId);
  }

  @ApiCreatedResponse()
  @ApiUnauthorizedResponse()
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiScopes('session')
  @Post()
  @ApiOperationName({
    description: 'Create session',
  })
  async createSession(
    @Body() session: SessionDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<SessionDto> {
    // an absent appId is refused by create()
    if (session?.appId) await this.auth.assertAppAccess(user, session.appId);
    return this.session.create(session);
  }

  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiBadRequestResponse()
  @ApiScopes('session')
  @Put()
  @ApiOperationName({
    description: 'Update session',
  })
  async updateSession(
    @Body() session: SessionDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<SessionDto> {
    await this.readOwnSession(session.sessionId, user);
    return this.session.update(session);
  }
}
