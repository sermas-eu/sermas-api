import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { SermasRecordChangedOperation } from '#libs/sermas/sermas.dto';
import { uuidv4 } from '#libs/util';
import { XRMarkerAsyncApiService } from './xr.marker.async.service.js';
import { XRMarkerDto, XRMarkerListRequestDto } from './xr.marker.dto.js';

@Injectable()
export class XrMarkerService {
  private readonly logger = new Logger(XrMarkerService.name);
  private readonly markers: XRMarkerDto[] = [];

  constructor(private readonly xrMarkerAsync: XRMarkerAsyncApiService) {}

  async search(payload: XRMarkerListRequestDto, _user?: AuthJwtUser) {
    return Object.values(this.markers)
      .filter((m) => m.appId === payload.appId)
      .filter((m) => {
        if (!payload.markerId || !payload.markerId.length) return true;
        return payload.markerId.includes(m.markerId);
      })
      .filter((m) => {
        if (!payload.payload || !payload.payload.length) return true;
        return payload.payload.includes(m.payload);
      })
      .filter((m) => {
        if (!payload.tags || !payload.tags.length) return true;
        return (m.tags || []).some((tag) => payload.tags.includes(tag));
      });
  }

  async publish(record: XRMarkerDto, operation: SermasRecordChangedOperation) {
    await this.xrMarkerAsync.changed({
      operation,
      record,
      appId: record.appId,
      ts: new Date(),
      userId: record.userId ? record.userId : undefined,
    });
  }

  async save(payload: XRMarkerDto, _user?: AuthJwtUser) {
    const exists = payload.markerId ? true : false;
    payload.markerId = payload.markerId || uuidv4();
    this.markers[payload.markerId] = payload;
    await this.publish(payload, exists ? 'updated' : 'created');
    return payload;
  }

  async read(markerId: string, _user?: AuthJwtUser) {
    if (!this.markers[markerId]) throw new NotFoundException();
    return this.markers[markerId];
  }

  async remove(markerId: string, _user?: AuthJwtUser) {
    if (!this.markers[markerId]) return;
    const record = this.markers[markerId];
    delete this.markers[markerId];
    await this.publish(record, 'deleted');
  }
}
