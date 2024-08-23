import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthenticatedUser, AuthGuard } from 'nest-keycloak-connect';
import { AuthJwtUser } from '../auth.dto';
import { MqttAclPayload } from './mqtt.dto';
import { MqttService } from './mqtt.service';

@Controller('mqtt')
@UseGuards(AuthGuard)
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @Post('auth')
  checkToken(@AuthenticatedUser() user: AuthJwtUser) {
    if (!user) throw new UnauthorizedException();
    return this.mqttService.checkUser(user);
  }

  @Post('auth/su')
  su(@AuthenticatedUser() user: AuthJwtUser) {
    if (!user) throw new UnauthorizedException();
    return this.mqttService.checkUser(user, true);
  }

  @Post('acl')
  async acl(
    @Req() request: any,
    @AuthenticatedUser() user: AuthJwtUser,
    @Body() payload: MqttAclPayload,
  ) {
    if (!user) throw new UnauthorizedException();
    await this.mqttService.checkAcl(user, payload, request);
  }
}
