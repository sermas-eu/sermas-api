import { Injectable, Logger } from '@nestjs/common';
import { MonitorService } from 'libs/monitor/monitor.service';
import { DialogueAsyncApiService } from './dialogue.async.service';
import {
  DialogueSessionRequestEvent,
  DialogueSessionRequestStatus,
  DialogueSessionRequestTracker,
} from './dialogue.request-monitor.dto';

const CACHE_TTL = 3 * 60 * 1000; // 3 min

const MAX_REQUEST_THRESHOLD_SECONDS = 6; // seconds

@Injectable()
export class DialogueRequestMonitorService {
  private readonly logger = new Logger(DialogueRequestMonitorService.name);

  // { sessionId: { requestId: {} }}
  private readonly requestMonitor: Record<
    string,
    Record<string, DialogueSessionRequestTracker>
  > = {};

  constructor(
    private readonly asyncApi: DialogueAsyncApiService,
    private readonly monitor: MonitorService,
  ) {}

  private clearCached() {
    for (const sessionId in this.requestMonitor) {
      for (const requestId in this.requestMonitor[sessionId]) {
        const req = this.requestMonitor[sessionId][requestId];
        if (!req.ts || new Date(req.ts).getTime() + CACHE_TTL < Date.now()) {
          this.logger.verbose(
            `Removed staled requestId=${req.requestId} sessionId=${req.sessionId}`,
          );
          delete this.requestMonitor[sessionId][requestId];
        }
      }
    }
  }

  getRequestStatus(
    sessionId: string,
    requestId: string,
  ): DialogueSessionRequestStatus | undefined {
    if (!this.requestMonitor[sessionId]) return undefined;
    if (!this.requestMonitor[sessionId][requestId]) return undefined;
    return this.requestMonitor[sessionId][requestId].status;
  }

  isRequestActive(sessionId: string, requestId: string) {
    const status = this.getRequestStatus(sessionId, requestId);
    if (status === undefined) return undefined;
    return status === 'started' || status === 'processing';
  }

  isRequestCancelled(sessionId: string, requestId: string) {
    const status = this.getRequestStatus(sessionId, requestId);
    if (status === undefined) return undefined;
    return status === 'cancelled';
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
        label: `request:${ev.requestId}`,
        threshold: ev.threshold || 8000,
      });

      const req: DialogueSessionRequestTracker = {
        appId: ev.appId,
        requestId: ev.requestId,
        sessionId: ev.sessionId,
        status: ev.status,
        ts: ev.ts || new Date(),
        perf,
      };

      this.requestMonitor[ev.sessionId][ev.requestId] = req;

      this.publishEvent(req.sessionId, req.requestId);

      this.logger.verbose(`Started requestId=${ev.requestId}`);
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

    const logLevel =
      tookRounded > MAX_REQUEST_THRESHOLD_SECONDS ? 'debug' : 'verbose';

    this.logger[logLevel](
      `request status=${req.status} took=${tookRounded}s requestId=${ev.requestId} sessionId=${req.sessionId}`,
    );

    this.publishEvent(req.sessionId, req.requestId);
  }

  async publishEvent(sessionId: string, requestId: string) {
    if (!this.requestMonitor[sessionId]) return;
    const req = this.requestMonitor[sessionId][requestId];
    if (!req) return;
    await this.asyncApi.request({
      appId: req.appId,
      status: req.status,
      requestId: req.requestId,
      sessionId: req.sessionId,
      ts: new Date(),
    });
  }
}
