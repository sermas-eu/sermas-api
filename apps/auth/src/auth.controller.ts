import {
  Body,
  Controller,
  Delete,
  Get,
  NotImplementedException,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';
import {
  AuthJwtUser,
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenRequestDto,
  RegistrationRequestDto,
  RegistrationResponseDto,
  UpdateUserRequestDto,
} from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
@ApiResource('auth')
@ApiTags('AUTHENTICATION')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('/whoami')
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    type: AuthJwtUser,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authorized',
  })
  @ApiScopes('login')
  @ApiOperationName()
  whoami(@Req() req: Request) {
    return this.auth.whoami(req.headers.authorization);
  }

  @Public()
  @Post('/login')
  @ApiResponse({
    status: 200,
    description: 'Login user',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authorized',
  })
  @ApiScopes('login')
  @ApiOperationName()
  login(@Body() payload: LoginRequestDto): Promise<LoginResponseDto> {
    return this.auth.login(payload);
  }

  @Public()
  @Post('register')
  @ApiResponse({
    status: 201,
    description: 'Register a new user',
    type: RegistrationResponseDto,
  })
  @ApiScopes('register')
  @ApiOperationName()
  async register(
    @Body() userData: RegistrationRequestDto,
  ): Promise<RegistrationResponseDto> {
    throw new NotImplementedException();
  }

  @ApiBearerAuth()
  @Public()
  @Post('/refresh')
  @ApiResponse({
    status: 200,
    description: 'Refresh token',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authorized',
  })
  @ApiScopes('register')
  @ApiOperationName()
  refreshToken(
    @Body() payload: RefreshTokenRequestDto,
    @AuthenticatedUser() user: AuthJwtUser,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    return this.auth.refresh(payload, req.headers.authorization, user);
  }

  @ApiBearerAuth()
  @Put(':userId')
  @ApiResponse({
    status: 200,
    description: 'Updates user data',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authorized',
  })
  @ApiScopes('management')
  @ApiOperationName()
  async edit(
    @Param('userId') user: string,
    @Body() updateUserData: UpdateUserRequestDto,
  ): Promise<void> {
    throw new NotImplementedException();
  }

  @ApiBearerAuth()
  @Delete(':userId')
  @ApiOperationName()
  @ApiResponse({
    status: 200,
    description: 'Deletes a user and all of its resources',
  })
  @ApiOkResponse()
  @ApiResponse({
    status: 401,
    description: 'Not authorized',
  })
  @ApiScopes('management')
  @ApiOperationName()
  async delete(@Param('userId') userId: string): Promise<void> {
    throw new NotImplementedException();
  }
}
