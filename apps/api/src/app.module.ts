import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SermasApiModule } from './sermas.api.module';
import { SermasBaseModule } from './sermas.base.module';

@Module({
  imports: [SermasBaseModule, SermasApiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
