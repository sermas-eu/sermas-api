import { Module } from '@nestjs/common';

import { EventEmitterModule } from '@nestjs/event-emitter';
import { MonitoringDatasetModule } from './dataset/monitoring.dataset.module';
import { MonitoringKpiService } from './monitoring.kpi.service';

@Module({
  imports: [EventEmitterModule, MonitoringDatasetModule],
  providers: [MonitoringKpiService],
})
export class MonitoringModule {}
