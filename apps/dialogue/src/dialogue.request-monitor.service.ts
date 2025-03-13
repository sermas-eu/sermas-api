import { Injectable, Logger } from '@nestjs/common';
import { SessionService } from 'apps/session/src/session.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import {
  DialogueSessionRequestEvent,
  DialogueSessionRequestTracker,
} from './dialogue.request-monitor.dto';

const CACHE_TTL = 3 * 60 * 1000; // 3 min

@Injectable()
export class DialogueRequestMonitorService {
  private readonly logger = new Logger(DialogueRequestMonitorService.name);

  // { sessionId: { requestId: {} }}
  private readonly requestMonitor: Record<
    string,
    Record<string, DialogueSessionRequestTracker>
  > = {};

  constructor(
    private readonly session: SessionService,
    private readonly monitor: MonitorService,
  ) {}

  private clearCached() {
    for (const sessionId in this.requestMonitor) {
      for (const requestId in this.requestMonitor[sessionId]) {
        const req = this.requestMonitor[sessionId][requestId];
        if (!req.ts || new Date(req.ts).getTime() + CACHE_TTL < Date.now()) {
          this.logger.debug(
            `Removed staled requestId=${req.requestId} sessionId=${req.sessionId}`,
          );
          delete this.requestMonitor[sessionId][requestId];
        }
      }
    }
  }

  isRequestActive(sessionId: string, requestId: string) {
    if (!this.requestMonitor[sessionId]) return false;
    if (!this.requestMonitor[sessionId][requestId]) return false;
    return (
      this.requestMonitor[sessionId][requestId].status === 'started' ||
      this.requestMonitor[sessionId][requestId].status === 'processing'
    );
  }

  getActiveRequests(sessionId: string) {
    if (!this.requestMonitor[sessionId]) return false;
    const activeRequests: Record<string, DialogueSessionRequestEvent> = {};
    for (const requestId in this.requestMonitor[sessionId]) {
      if (!this.isRequestActive(sessionId, requestId)) continue;
      activeRequests[requestId] = this.requestMonitor[sessionId][requestId];
    }
    return activeRequests;
  }

  cancelRequests(sessionId: string, activeRequestId?: string) {
    // this.logger.debug(
    //   `Cancelling requests for sessionId=${sessionId} activeRequestId=${activeRequestId || ''}`,
    // );
    for (const requestId in this.requestMonitor[sessionId]) {
      if (activeRequestId && activeRequestId === requestId) {
        continue;
      }
      const req = this.requestMonitor[sessionId][requestId];
      if (this.isRequestActive(sessionId, requestId)) {
        this.updateRequestStatus({
          ...req,
          status: 'cancelled',
        });
      }
    }
  }

  async updateRequestStatus(ev: DialogueSessionRequestEvent) {
    // remove older requests
    this.clearCached();

    if (!ev.requestId || !ev.sessionId) return;

    this.requestMonitor[ev.sessionId] = this.requestMonitor[ev.sessionId] || {};

    // start tracking request
    if (ev.status === 'started') {
      this.cancelRequests(ev.sessionId, ev.requestId);

      const perf = this.monitor.performance({
        ...ev,
        label: `request-monitor:${ev.requestId}`,
        threshold: ev.threshold || 8000,
      });

      this.requestMonitor[ev.sessionId][ev.requestId] = {
        ...ev,
        ts: ev.ts || new Date(),
        perf,
      };

      this.logger.debug(`Started requestId=${ev.requestId}`);
      return;
    }

    const req = this.requestMonitor[ev.sessionId][ev.requestId];
    if (!req) {
      this.logger.debug(
        `requestId=${ev.requestId} not tracked sessionId=${ev.sessionId}`,
      );
      return;
    }

    // update status
    req.status = ev.status;

    const took = req.perf(req.status, false);
    const tookRounded = Math.round((took / 1000) * 10) / 10;
    const logLevel = tookRounded > 4 ? 'warn' : 'debug';
    this.logger[logLevel](
      `request status=${req.status} took=${tookRounded}s requestId=${ev.requestId} sessionId=${req.sessionId}`,
    );
  }
}
