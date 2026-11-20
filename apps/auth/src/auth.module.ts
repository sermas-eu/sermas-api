import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthAdminController } from './auth.admin.controller.js';
import { AuthAsyncApiService } from './auth.async.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MqttController } from './mqtt/mqtt.controller.js';
import { MqttService } from './mqtt/mqtt.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController, MqttController, AuthAdminController],
  providers: [AuthService, MqttService, AuthAsyncApiService],
  exports: [],
})
export class AuthModule {}
