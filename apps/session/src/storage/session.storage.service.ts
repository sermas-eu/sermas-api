import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import { toDTO, uuidv4 } from 'libs/util';
import { FilterQuery, Model } from 'mongoose';
import { SessionStorageAsyncApiService } from './session.storage.async.service';
import {
  SessionStorageEventDto,
  SessionStorageRecordDto,
  SessionStorageSearchDto,
} from './session.storage.dto';
import { SessionStorage } from './session.storage.schema';

@Injectable()
export class SessionStorageService {
  private readonly logger = new Logger(SessionStorageService.name);

  constructor(
    @InjectModel(SessionStorage.name)
    private storageModel: Model<SessionStorage>,
    private readonly asyncApi: SessionStorageAsyncApiService,
  ) {}

  async read(filter?: FilterQuery<SessionStorage>) {
    const record = await this.storageModel.findOne(filter);
    return record || null;
  }

  async search(data: SessionStorageSearchDto) {
    if (!data.sessionId) throw new BadRequestException('sessionId is missing');

    const filter: FilterQuery<SessionStorage> = {
      sessionId: data.sessionId,
    };

    if (data.appId) {
      filter.appId = data.appId;
    }

    if (data.userId) {
      filter.userId = data.userId;
    }

    const result = await this.storageModel.find(filter);

    return result.map((r) => toDTO<SessionStorageRecordDto>(r));
  }

  async set(data: SessionStorageRecordDto) {
    if (!data.appId) throw new BadRequestException('missing appId');
    if (!data.userId) throw new BadRequestException('missing userId');

    let exists = true;
    let record = await this.read({
      appId: data.appId,
      sessionId: data.sessionId,
      storageId: data.storageId || undefined,
    });

    // if (data.storageId && !record) {
    //   throw new NotFoundException(
    //     `record not found storageId=${data.storageId}`,
    //   );
    // }

    if (!record) {
      exists = false;
      record = new this.storageModel({
        appId: data.appId,
        sessionId: data.sessionId,
        userId: data.userId,
        storageId: data.storageId || uuidv4(),
      });
    }

    record.ts = new Date();
    record.data = data.data;
    await record.save();

    const dto = toDTO<SessionStorageRecordDto>(record);
    await this.publish(dto, exists ? 'updated' : 'created');
    this.logger.verbose(
      `Store ${exists ? 'updated' : 'created'} storageId=${dto.storageId} userId=${record.userId || ''}`,
    );

    return dto;
  }

  async get(storageId: string, userId?: string) {
    const record = await this.read({ storageId });
    if (!record) {
      this.logger.warn(
        `Store not found storageId=${storageId} userId=${userId}`,
      );
      throw new NotFoundException('record not found');
    }

    this.logger.verbose(
      `Store loaded storageId=${record.storageId} userId=${userId}`,
    );
    return toDTO<SessionStorageRecordDto>(record);
  }

  async del(storageId: string, userId?: string) {
    if (!storageId) throw new BadRequestException('missing storageId');
    const record = await this.get(storageId, userId);
    const res = await this.storageModel.deleteOne({ storageId, userId });
    if (res?.deletedCount > 0) {
      await this.publish(record, 'deleted');
    }
  }

  async publish(
    record: SessionStorageRecordDto,
    operation: SermasRecordChangedOperation,
  ) {
    const ev: SessionStorageEventDto = {
      record,
      operation,
      appId: record.appId,
      ts: new Date(),
      userId: record.userId,
    };
    await this.asyncApi.storageUpdated(ev);
  }
}
