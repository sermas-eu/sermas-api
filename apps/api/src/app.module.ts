import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SermasApiModule } from './sermas.api.module.js';
import { SermasBaseModule } from './sermas.base.module.js';

@Module({
  imports: [SermasBaseModule, SermasApiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
