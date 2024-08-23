import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { jwtDecode } from 'libs/util';
import { PlatformAuthService } from '../auth/platform.auth.service';
import { ModuleProxyRequestDto } from './mod.dto';
import { PlatformModuleService } from './mod.service';

@Injectable()
export class PlatformModuleProxyService {
  private readonly logger = new Logger(PlatformModuleProxyService.name);

  constructor(
    private readonly platformModule: PlatformModuleService,
    private readonly auth: PlatformAuthService,
  ) {}

  async proxyUserRequest(req: ModuleProxyRequestDto, token: string) {
    const wrapper = await this.platformModule.getModuleWrapper(req.moduleId);
    if (wrapper === null) {
      throw new NotFoundException(`Module ${req.moduleId} not found`);
    }

    const operation = wrapper[req.operationId];

    let appId: string = undefined;
    if (req.params?.appId) {
      appId = req.params.appId;
    }
    if (!appId && req.body?.appId) {
      appId = req.body.appId;
    }
    if (!appId && req.qs?.appId) {
      appId = req.qs.appId;
    }

    // if (!appId) throw new BadRequestException(`Failed to find appId parameter`);

    let user: AuthJwtUser;
    try {
      user = jwtDecode<AuthJwtUser>(token);
    } catch (e: any) {
      this.logger.warn(`Failed to parse token ${e.stack}`);
      throw new UnauthorizedException(`Invalid token`);
    }

    // enforce request
    const userId = user.sub;
    const clientId = user.aud;
    this.logger.log(
      `Enforcing request for ${operation.resource.resource}.${operation.resource.scope} userId=${userId} clientId=${clientId}`,
    );
    try {
      const allowed = await this.auth.isAllowed({
        appId: appId,
        token,
        userId: user.sub,
        clientId: user.aud,
        resource: operation.resource.resource,
        scopes: [operation.resource.scope],
      });

      this.logger.debug(
        `Proxy request ${operation.resource.resource}.${
          operation.resource.scope
        } userId=${userId} clientId=${clientId} ${
          allowed ? '' : 'NOT'
        } ALLOWED `,
      );

      if (!allowed) throw new UnauthorizedException();
    } catch (e: any) {
      this.logger.warn(
        `Not allowed ${operation.resource.resource}.${operation.resource.scope} userId=${userId} clientId=${clientId}: ${e.message}`,
      );
      throw new UnauthorizedException();
    }

    return await this.proxy(req);
  }

  async proxy(req: ModuleProxyRequestDto) {
    const wrapper = await this.platformModule.getModuleWrapper(req.moduleId);
    if (wrapper === null) {
      throw new NotFoundException(`Module ${req.moduleId} not found`);
    }

    const { operationId, params, body } = req;
    const { openapi, resource, moduleId } = wrapper[operationId];
    const { client } = openapi;

    this.logger.debug(`Proxy requesting ${moduleId}.${operationId}`);

    try {
      const res = await client[resource.operationId](params, body);
      this.logger.debug(`Request suceeded ${moduleId}.${operationId}`);
      return res.data;
    } catch (e: any) {
      this.logger.warn(`Request failed ${moduleId}.${operationId}: ${e.stack}`);
      throw new InternalServerErrorException(
        `Proxy request failed for ${moduleId}.${operationId}`,
      );
    }
  }
}
