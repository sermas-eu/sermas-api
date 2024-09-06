import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Perf } from 'libs/performance';
import {
  MonitorContextDto,
  MonitorLogDto,
  MonitorRecordDto,
} from './monitor.dto';

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  private emit(context: MonitorRecordDto) {
    const ev: MonitorRecordDto = {
      appId: context.appId,
      sessionId: context.sessionId,
      threshold: context.threshold,
      type: context.type,
      label: context.label,
      value: context.value || null,
      ts: context.ts || new Date(),
    };
    this.emitter.emit('monitor', ev);
  }

  log(context: MonitorLogDto) {
    this.emit({
      ...context,
      type: context.type || 'log',
      value: context.value || null,
      ts: new Date(),
    });
  }

  performance(context: MonitorContextDto) {
    const { label, threshold } = context;

    const perf = Perf.start(label, threshold, this.logger);

    const perfWrapper = (label2?: string, print = false) => {
      const elapsed = perf(label2, false);

      const fullLabel = `${label || ''} ${label2 || ''}`;

      if (print) this.logger.verbose(`${fullLabel} ${Math.floor(elapsed)}ms`);

      const ev: MonitorRecordDto = {
        appId: context.appId,
        sessionId: context.sessionId,
        threshold: context.threshold,
        type: 'performance',
        label: fullLabel,
        value: elapsed,
        ts: new Date(),
      };

      this.emit(ev);

      return elapsed;
    };

    return perfWrapper;
  }

  error(context: MonitorLogDto) {
    const ev: MonitorRecordDto = {
      ...context,
      type: 'error',
      value: context.value || null,
      ts: new Date(),
    };
    this.emitter.emit('monitor.error', ev);
  }
}
