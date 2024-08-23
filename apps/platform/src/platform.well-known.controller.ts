import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { ASYNCAPI_BASEURL, OPENAPI_BASEURL } from './mod/constants';
import { SermasWellKnowDto } from './platform.well-known.dto';

@Controller('.well-known')
export class PlatformWellKnownController {
  @Get('sermas.json')
  @ApiExcludeEndpoint()
  wellKnownSermasXr() {
    const wellKnown: SermasWellKnowDto = {
      openapiSpec: `${ASYNCAPI_BASEURL}-json`,
      openapiUi: OPENAPI_BASEURL,

      asyncapiSpec: `${ASYNCAPI_BASEURL}-json`,
      asyncapiUi: ASYNCAPI_BASEURL,
    };

    return wellKnown;
  }
}
