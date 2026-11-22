import { Module } from '@nestjs/common';
import { AuthModule } from '#apps/auth/src/auth.module';
import { UIAsyncApiService } from '#apps/ui/src/ui.async.service';
import { NavigationController } from './navigation.controller.js';
import { NavigationService } from './navigation.service.js';

@Module({
  imports: [AuthModule],
  providers: [NavigationService, UIAsyncApiService],
  controllers: [NavigationController],
  exports: [NavigationService],
})
export class NavigationModule {}
