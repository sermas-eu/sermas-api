import {
  Body,
  Controller,
  NotImplementedException,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import {
  SessionSupportRequestDto,
  SessionSupportResponseDto,
} from './session.support.dto';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';

@ApiBearerAuth()
@Controller('session')
@ApiResource('session')
@ApiTags('SESSION')
export class SessionSupportController {
  @Post('support')
  @ApiResponse({
    status: 200,
    description: 'Human support requested',
    type: SessionSupportResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'unauthorized',
  })
  @ApiScopes('support')
  @ApiOperationName({
    description: 'Request support from human',
  })
  support(
    @Body() data: SessionSupportRequestDto,
    @AuthenticatedUser()
    user?: any,
  ): Promise<SessionSupportResponseDto> {
    throw new NotImplementedException();
  }
}
