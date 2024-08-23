import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from 'libs/decorator/admin-role.decorator';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { RegistrationRequestDto, RegistrationResponseDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiBearerAuth()
@Controller('auth/admin')
@ApiResource('auth')
@AdminRole()
@ApiTags('AUTHENTICATION')
export class AuthAdminController {
  constructor(private readonly auth: AuthService) {}

  @Post('user')
  @ApiScopes('management')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  @ApiOperationName({
    description: 'create or update an user',
  })
  saveUser(
    @Body() payload: RegistrationRequestDto,
  ): Promise<RegistrationResponseDto> {
    return this.auth.saveUser(payload);
  }

  @Post('import')
  @ApiScopes('management')
  @ApiOkResponse({
    type: [RegistrationResponseDto],
  })
  @ApiBadRequestResponse()
  @ApiOperationName({
    description: 'import users',
  })
  @ApiBody({
    type: [RegistrationRequestDto],
  })
  importUsers(
    @Body() payload: RegistrationRequestDto[],
  ): Promise<RegistrationResponseDto[]> {
    return this.auth.importUsers(payload);
  }
}
