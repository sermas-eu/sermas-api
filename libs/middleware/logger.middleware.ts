import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { NextFunction, Request, Response } from 'express';
import { jwtDecode } from 'libs/util';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);

  use(request: Request, response: Response, next: NextFunction) {
    if (process.env.LOG_REQUEST !== '1') {
      if (next) next();
      return;
    }

    const { ip, method, path: url } = request;
    const userAgent = request.get('user-agent') || '';

    let jwtInfo = '';
    if (request.headers.authorization) {
      const jwt = jwtDecode<AuthJwtUser>(request.headers.authorization);
      jwtInfo = ` [clientId=${jwt.azp} userId=${jwt.sub} username=${jwt.preferred_username} aud=${jwt.aud}]`;
    } else {
      jwtInfo = `[no authorization token]`;
    }

    response.on('close', () => {
      const { statusCode } = response;

      this.logger.log(
        `${method} ${url} ${statusCode} - ${userAgent} ${ip} ${jwtInfo}`,
      );
    });

    if (next) next();
  }
}
