import { Global, Module } from '@nestjs/common';
import { MonitorService } from './monitor.service';

@Global()
@Module({
  imports: [],
  providers: [MonitorService],
  exports: [MonitorService],
})
export class MonitorModule {}
