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
import { AuthenticatedUser } from 'nest-keycloak-connect';
import {
  AgentEvaluatePromptDto,
  AgentEvaluatePromptResponseDto,
} from './session.prompt.dto';
import { SessionPromptService } from './session.prompt.service';

@ApiBearerAuth()
@Controller('session/agent')
@ApiResource('session')
@ApiTags('SESSION')
export class SessionPromptController {
  constructor(private promptService: SessionPromptService) {}

  @ApiOkResponse({
    type: AgentEvaluatePromptResponseDto,
  })
  @ApiUnauthorizedResponse()
  @ApiBadRequestResponse()
  @ApiScopes('agent')
  @Post('/prompt')
  @ApiOperationName({
    description: 'Evaluate a prompt within the session context',
  })
  async prompt(
    @Body() payload: AgentEvaluatePromptDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ): Promise<AgentEvaluatePromptResponseDto> {
    return this.promptService.prompt(payload);
  }
}
