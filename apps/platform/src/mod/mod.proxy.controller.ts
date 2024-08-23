import { All, Controller, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from 'nest-keycloak-connect';
import { PlatformModuleProxyService } from './mod.proxy.service';

@Controller()
export class PlatformModuleProxyController {
  constructor(private readonly module: PlatformModuleProxyService) {}

  @All('module/:moduleId/:operationId')
  @Public()
  trigger(
    @Param('moduleId') moduleId: string,
    @Param('operationId') operationId: string,
    @Req() req: Request,
  ) {
    const { body, params, query } = req;
    return this.module.proxyUserRequest(
      {
        moduleId,
        operationId,
        body,
        params,
        qs: query,
      },
      req.headers.authorization,
    );
  }
}
