import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { AsyncApiOperation } from 'nestjs-asyncapi';

class TestStuffEmbed {
  @ApiProperty()
  appId: string;
}

class TestStuff {
  @ApiProperty()
  name: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  enabled: true;
  @ApiProperty()
  myapp: boolean;
  @ApiProperty()
  params: TestStuffEmbed;
  @ApiProperty()
  body: any;
}

@Controller()
@ApiTags('stuff')
export class TestCustomModuleController {
  @Get('.well-known/sermas.json')
  @ApiExcludeEndpoint()
  wellKnown() {
    return {
      openapiSpec: '/openapi-json',
      asyncapiSpec: '/asyncapi-json',
    };
  }

  @AsyncApiOperationName({
    operationId: 'sendStuff',
    channel: 'app/:appId/stuff/send',
    type: 'pub',
    message: {
      payload: TestStuff,
    },
  })
  @Post('myapp/trigger/:appId')
  @ApiOperationName()
  @ApiOkResponse({
    type: TestStuff,
  })
  @ApiBody({
    type: TestStuff,
  })
  sendStuff(@Param('appId') appId: string, @Body() body: TestStuff) {
    return {
      myapp: true,
      params: { appId },
      body,
    };
  }

  @Get('myapp/something/:appId')
  @ApiOperationName()
  @ApiBody({
    type: [TestStuff],
  })
  getSomething(@Param('appId') appId: string, @Body() body: TestStuff[]) {
    return [
      {
        myapp: true,
        params: { appId },
        body,
      },
      {
        myapp: true,
        params: { appId },
        body,
      },
    ];
  }

  @AsyncApiOperationName({
    operationId: 'listAllStuff',
    type: 'pub',
    channel: 'app/:appId/stuff/list',
    message: {
      payload: TestStuff,
    },
  })
  @Get('myapp/list')
  @ApiOperationName()
  @ApiOkResponse({
    type: [TestStuff],
  })
  listAllStuff(@Query('appId') appId: string, @Body() body: any) {
    return [
      {
        myapp: true,
        params: { appId },
        body,
      },
      {
        myapp: true,
        params: { appId },
        body,
      },
    ];
  }
}
