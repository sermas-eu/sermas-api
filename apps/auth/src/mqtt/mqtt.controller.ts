import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthenticatedUser } from '#libs/auth/auth.decorators';
import { JwtAuthGuard } from '#libs/auth/jwt.guard';
import { AuthJwtUser } from '../auth.dto.js';
import { MqttAclPayload } from './mqtt.dto.js';
import { MqttService } from './mqtt.service.js';

@Controller('mqtt')
@UseGuards(JwtAuthGuard)
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
