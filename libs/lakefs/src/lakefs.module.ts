import { Module } from '@nestjs/common';
import { LakeFSService } from './lakefs.service';

@Module({
  imports: [],
  controllers: [],
  providers: [LakeFSService],
  exports: [LakeFSService],
})
export class LakeFSModule {}
