import { All, Controller, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import type { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { JwtAuthGuard } from '#libs/auth/jwt.guard';
import { PlatformModuleProxyService } from './mod.proxy.service.js';

@Controller()
export class PlatformModuleProxyController {
  constructor(private readonly module: PlatformModuleProxyService) {}

  // the token must verify: the service only reads the identity it carries
  @All('module/:moduleId/:operationId')
  @UseGuards(JwtAuthGuard)
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
      (req as Request & { user?: AuthJwtUser }).user,
    );
  }
}
