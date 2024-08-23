import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformKeycloakService } from 'apps/platform/src/platform.keycloack.service';
import { jwtDecode } from 'libs/util';

import {
  AuthJwtUser,
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenRequestDto,
  RegistrationRequestDto,
  RegistrationResponseDto,
} from './auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger();
  constructor(
    private readonly config: ConfigService,
    private readonly keycloak: PlatformKeycloakService,
  ) {}

  async saveUser(payload: RegistrationRequestDto) {
    await this.keycloak.saveUser(payload);
    const result = await this.importUsers([payload]);
    if (!result.length) throw new BadRequestException(`Failed to save user`);
    return result.at(0);
  }

  async importUsers(users: RegistrationRequestDto[]) {
    const result: RegistrationResponseDto[] = [];
    for (const user of users) {
      try {
        this.logger.debug(`Saving user username=${user.username}`);
        const userRecord = await this.keycloak.saveUser(user);
        result.push({
          userId: userRecord.username,
        });
      } catch (e: any) {
        this.logger.warn(
          `Failed to save user username=${user.username}: ${e.stack}`,
        );
        throw new BadRequestException(`Failed to save user ${user.username}`);
      }
    }
    return result;
  }

  async whoami(token: string) {
    return jwtDecode<AuthJwtUser>(token);
  }

  async login(payload: LoginRequestDto): Promise<LoginResponseDto> {
    if (!payload.username || payload.username.length < 3)
      throw new BadRequestException('missing username');
    if (!payload.password || payload.username.length < 3)
      throw new BadRequestException('missing password');

    let clientId = payload.clientId;

    // use {appId}-application to login
    if (!clientId && payload.appId) {
      clientId = `${payload.appId}-application`;
    }

    const res = await this.keycloak.login(
      payload.username,
      payload.password,
      clientId,
    );

    if (res === null) {
      this.logger.debug(
        `Login failed for ${payload.username} clientId=${payload.clientId} appId=${payload.appId}`,
      );
      throw new UnauthorizedException();
    }
    return res;
  }

  async refresh(
    payload: RefreshTokenRequestDto,
    accessToken: string,
    user: AuthJwtUser,
  ): Promise<LoginResponseDto> {
    if (!payload.refreshToken || payload.refreshToken.length < 3)
      throw new BadRequestException('missing refreshToken');

    const clientId = payload.clientId || user.clientId;

    const res = await this.keycloak.refreshToken(
      accessToken,
      payload.refreshToken,
      clientId,
    );

    if (res === null) {
      throw new UnauthorizedException();
    }

    return res;
  }
}
