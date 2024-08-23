import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { addDTOContext } from 'libs/util';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { AgentDto, AgentHeartBeatEventDto } from './session.agent.dto';
import { SessionAgentService } from './session.agent.service';

@ApiBearerAuth()
@Controller('session/agent')
@ApiResource('session')
@ApiTags('SESSION')
export class SessionAgentController {
  constructor(private agent: SessionAgentService) {}

  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiBadRequestResponse()
  @ApiScopes('agent')
  @Post()
  @ApiOperationName({
    description: 'Notifies of an agent update',
  })
  async agentUpdate(
    @Body() payload: AgentHeartBeatEventDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<AgentDto[]> {
    return this.agent.onAgentHeartBeat(
      addDTOContext<AgentHeartBeatEventDto>(payload, { user }),
    );
  }
}
