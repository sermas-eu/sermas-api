import { Global, Module } from '@nestjs/common';
import { PlatformTopicsService } from './platform.topics.service';

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [PlatformTopicsService],
  exports: [PlatformTopicsService],
})
export class PlatformTopicsModule {}
