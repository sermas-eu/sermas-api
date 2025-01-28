import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { SessionService } from 'apps/session/src/session.service';
import { DialogueActor } from 'libs/language/dialogue.message.dto';
import { getChunkId } from 'libs/sermas/sermas.utils';
import { toDTO } from 'libs/util';
import { FilterQuery, Model } from 'mongoose';
import { MinioService } from 'nestjs-minio-client';
import { MonitoringAsyncApiService } from './monitoring.async.service';
import {
  DatasetRecordDto,
  DatasetRecordFilterDto,
  AdvancedDatasetRecordFilterDto,
  LogType,
  MonitoringRecordDto,
} from './monitoring.dataset.dto';
import { DatasetRecord } from './monitoring.dataset.schema';
import { SessionContext } from 'apps/session/src/session.context';

@Injectable()
export class MonitoringDatasetService {
  private readonly logger = new Logger(MonitoringDatasetService.name);

  private enabled = false;
  private readonly repository: string;

  constructor(
    private readonly config: ConfigService,
    @InjectModel(DatasetRecord.name)
    private datasetRecord: Model<DatasetRecord>,
    private readonly minioService: MinioService,
    private readonly session: SessionService,
    private readonly emitter: EventEmitter2,
    private readonly asyncApi: MonitoringAsyncApiService,
  ) {
    this.repository = this.config.get('DATASET_BUCKET');
    if (!this.repository) {
      this.enabled = false;
      this.logger.warn(
        `DATASET_BUCKET missing, dataset buffer will be skipped.`,
      );
    }
  }

  async onModuleInit() {
    this.enabled = this.config.get('DATASET_ENABLED') === '1';
    if (!this.enabled) {
      this.logger.log(`Data logger is disabled`);
    }
    if (this.repository && this.enabled) {
      await this.ensureRepository();
    }
  }

  async ensureRepository() {
    try {
      const exists = await this.minioService.client.bucketExists(
        this.repository,
      );
      if (!exists) {
        await this.minioService.client.makeBucket(
          this.repository,
          this.config.get('REPOSITORY_BUCKET_REGION'),
        );
        this.logger.log(`Created bucket=${this.repository}`);
      }
    } catch (e) {
      this.logger.error(
        `Failed to create repository ${this.repository}: ${e.stack}`,
      );
      this.enabled = false;
    }
  }

  async saveAudio(payload: {
    appId: string;
    sessionId: string;
    chunkId?: string;
    actor: DialogueActor;
    buffer: Buffer;
  }) {
    if (!this.enabled) return;
    const chunkId = payload.chunkId || getChunkId();
    const assetPath = `audio/${payload.appId}/${payload.sessionId}/${payload.actor}/${chunkId}.wav`;
    try {
      await this.minioService.client.putObject(
        this.repository,
        assetPath,
        payload.buffer,
        {
          appId: payload.appId,
          sessionId: payload.sessionId,
          chunkId,
          actor: payload.actor,
        },
      );
      this.logger.verbose(`Saved audio chunck path=${assetPath}`);
    } catch (e: any) {
      this.logger.warn(`Failed to save audio chunk ${assetPath}: ${e.stack}`);
    }
  }

  async save(
    label: string,
    data: unknown & SessionContext,
    type: LogType,
  ): Promise<void> {
    // this.logger.debug('Save log');

    if (!this.enabled) return;

    // if (!data.sessionId) {
    //   this.logger.warn(`Skip log for ${type}: missing sessionId`);
    //   return;
    // }

    if (!data.appId && data.sessionId) {
      const session = await this.session.read(data.sessionId, false);
      if (!session) {
        this.logger.warn(
          `Skip log for ${type}: session not found sessionId=${data.sessionId}`,
        );
        return;
      }
      data.appId = session.appId;
    }

    const record = new this.datasetRecord({
      label,
      appId: data.appId,
      sessionId: data.sessionId,
      data,
      type,
      ts: data.ts || new Date(),
    });

    await record.save();

    const dto = toDTO<DatasetRecordDto>(record);
    this.logger.verbose(`${dto.type}: ${dto.label}`);

    this.emitter.emit('monitoring.record', dto);

    const monitoringRecord: MonitoringRecordDto = { ...dto };
    if (monitoringRecord['data']) delete monitoringRecord['data'];
    await this.asyncApi.record(monitoringRecord);
  }

  async search(filter: DatasetRecordFilterDto) {
    const q: FilterQuery<DatasetRecord> = {
      sessionId: filter.sessionId,
    };

    if (filter.types && filter.types.length) {
      q.type = filter.types;
    }

    const records = await this.datasetRecord.find(q).exec();
    return records
      .map((r) => toDTO<DatasetRecordDto>(r))
      .map((r) => {
        const m = { ...r };
        if (m.data) delete m.data;
        return m as MonitoringRecordDto;
      });
  }

  async advancedSearch(filter: AdvancedDatasetRecordFilterDto) {
    const q: FilterQuery<MonitoringRecordDto> = {};
    if (filter.appId) {
      q.appId = filter.appId;
    }
    if (filter.sessionId) {
      q.sessionId = filter.sessionId;
    }
    if (filter.type) {
      q.type = filter.type;
    }
    if (filter.label) {
      q.label = filter.label;
    }
    q.ts = {};
    if (filter.sinceTs) {
      q.ts['$gte'] = filter.sinceTs;
    }
    if (filter.untilTs) {
      q.ts['$lte'] = filter.untilTs;
    }

    const records = await this.datasetRecord.find(q).exec();
    return records.map((r) => toDTO<MonitoringRecordDto>(r));
  }
}
