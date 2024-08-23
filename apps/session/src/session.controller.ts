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
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { SessionService } from 'apps/session/src/session.service';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { SessionDto, SessionSearchFilter } from './session.dto';

@ApiBearerAuth()
@Controller('session')
@ApiResource('session')
@ApiTags('SESSION')
export class SessionController {
  constructor(private session: SessionService) {}

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
  readSession(@Param('sessionId') sessionId: string): Promise<SessionDto> {
    if (!sessionId) throw new BadRequestException('Missing sessionId');
    return this.session.read(sessionId);
  }

  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiScopes('session')
  @ApiOperationName({
    description: 'Remove session',
  })
  @Delete(':sessionId')
  deleteSession(@Param('sessionId') sessionId: string): Promise<void> {
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
  async createSession(@Body() session: SessionDto): Promise<SessionDto> {
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
  updateSession(@Body() session: SessionDto): Promise<SessionDto> {
    return this.session.update(session);
  }
}
