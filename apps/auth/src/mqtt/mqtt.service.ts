import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformContextDto } from 'apps/platform/src/auth/platform.auth.dto';
import { PlatformAuthService } from 'apps/platform/src/auth/platform.auth.service';
import { Request } from 'express';
import { AuthJwtUser } from '../auth.dto';
import { MqttAclAcc, MqttAclPayload } from './mqtt.dto';

@Injectable()
export class MqttService {
  private readonly logger = new Logger(MqttService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly platform: PlatformAuthService,
  ) {}

  async checkUser(user: AuthJwtUser, checkSuperUser = false) {
    if (checkSuperUser) {
      if (!this.platform.isSystemClient(user.azp)) {
        throw new UnauthorizedException();
      }
    }
    // this.logger.debug(`User ${user.sub} authenticated`);
  }

  async checkAcl(user: AuthJwtUser, payload: MqttAclPayload, request: Request) {
    const action =
      payload.acc === MqttAclAcc.WRITE
        ? 'Write'
        : payload.acc === MqttAclAcc.READ
        ? 'Read'
        : 'Subscribe';

    if (process.env.LOG_REQUEST === '1')
      this.logger.debug(`ACL ${action} ${payload.topic} clientId=${user.azp}`);

    if (!this.checkTopicFormat(payload.topic)) {
      this.logger.log(`Invalid topic format ${payload.topic}`);
      throw new BadRequestException();
    }

    // // allow <userId> to interact with user/<userId>
    // const isUserTopic = await this.checkUserTopic(user, payload);
    // if (isUserTopic) {
    //   return;
    // }

    const context = this.loadContext(user, payload, request);
    if (context === null) {
      this.logger.warn(`failed to load context topic=${payload.topic}`);
      throw new UnauthorizedException('failed to load context');
    }

    // perform keycloak enforcing
    const isAllowed = await this.platform.isAllowed(context);
    if (!isAllowed) {
      this.logger.warn(
        `ACL not authorized appId=${context.appId} clientId=${
          context.clientId
        } ${context.resource}.${context.scopes.join(',')} userId=${
          context.userId
        } username=${user.preferred_username}`,
      );
      throw new UnauthorizedException();
    }
  }

  async checkUserTopic(user: AuthJwtUser, payload: MqttAclPayload) {
    const [prefix, userId] = payload.topic.split('/');
    return prefix === 'user' && userId === user.sub;
  }

  loadContext(
    user: AuthJwtUser,
    payload: MqttAclPayload,
    request: any,
  ): PlatformContextDto | null {
    const [, appId, resource, scope] = payload.topic.split('/'); // app/appId/resource/scope/{parameter}

    if (!appId || !resource || !scope) return null;

    return {
      appId,
      userId: user.sub,
      clientId: user.azp,
      resource,
      scopes: [scope],
      token: request.accessTokenJWT,
    };
  }

  checkTopicFormat(topic: string): boolean {
    const parts = topic.split('/');
    const [prefix] = parts;

    if (prefix !== 'app' && prefix !== 'user') {
      return false;
    }

    return true;
  }
}
