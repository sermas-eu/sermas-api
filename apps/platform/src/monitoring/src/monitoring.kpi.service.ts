import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DialogueTaskRecordChangedDto } from 'apps/dialogue/src/tasks/dialogue.tasks.dto';
import { DatasetRecordDto } from './dataset/monitoring.dataset.dto';
import { MonitoringDatasetService } from './dataset/monitoring.dataset.service';

@Injectable()
export class MonitoringKpiService {
  private readonly logger = new Logger(MonitoringKpiService.name);

  private enabled = false;
  private readonly repository: string;

  constructor(private readonly dataset: MonitoringDatasetService) {}

  @OnEvent('monitoring.record')
  async onMonitoring(ev: DatasetRecordDto) {
    // console.log(JSON.stringify(ev, null, 2));

    if (ev.type === 'task' && ev.data?.record) {
      const payload: DialogueTaskRecordChangedDto = ev.data;
      if (
        payload.record.status === 'completed' ||
        payload.record.status === 'aborted'
      ) {
        await this.dataset.save(
          `Task ${payload.record.status}`,
          {
            recordId: payload.record.recordId,
            taskId: payload.record.taskId,

            appId: payload.appId,
            sessionId: payload.sessionId,
          } as any,
          'kpi',
        );
      }
    }
  }
}
