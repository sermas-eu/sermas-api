import { Global, Module } from '@nestjs/common';
import { MonitorService } from './monitor.service.js';

@Global()
@Module({
  imports: [],
  providers: [MonitorService],
  exports: [MonitorService],
})
export class MonitorModule {}
