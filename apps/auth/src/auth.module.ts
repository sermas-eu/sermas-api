import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthAdminController } from './auth.admin.controller';
import { AuthAsyncApiService } from './auth.async.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MqttController } from './mqtt/mqtt.controller';
import { MqttService } from './mqtt/mqtt.service';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController, MqttController, AuthAdminController],
  providers: [AuthService, MqttService, AuthAsyncApiService],
  exports: [],
})
export class AuthModule {}
