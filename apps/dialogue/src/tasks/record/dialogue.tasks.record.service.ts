import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import { toDTO, uuidv4 } from 'libs/util';
import { FilterQuery, Model } from 'mongoose';
import { DialogueTasksAsyncApiService } from '../dialogue.tasks.async.service';
import {
  DialogueTaskChangedDto,
  DialogueTaskRecordChangedDto,
} from '../dialogue.tasks.dto';
import { DialogueTaskRecordDto } from './dialogue.tasks.record.dto';
import {
  DialogueTaskRecord,
  DialogueTaskRecordDocument,
} from './dialogue.tasks.record.schema';

@Injectable()
export class DialogueTaskRecordService implements OnModuleInit {
  private readonly logger = new Logger(DialogueTaskRecordService.name);

  constructor(
    @InjectModel(DialogueTaskRecord.name)
    private readonly taskRecord: Model<DialogueTaskRecord>,
    private readonly asyncApi: DialogueTasksAsyncApiService,
    private readonly emitter: EventEmitter2,
  ) {}

  onModuleInit() {
    //
  }

  @OnEvent('task.changed')
  // if a task is removed, abort the ongoing records
  async removeOngoingRecords(ev: DialogueTaskChangedDto) {
    if (!ev.record?.sessionId) return;
    if (ev.operation !== 'deleted') return;

    const records = await this.search({
      sessionId: ev.record.sessionId,
      taskId: ev.record.taskId,
    });

    if (!records.length) return;

    this.logger.debug(
      `Aborting ${records.length} ongoing records for taskId=${ev.record?.taskId}`,
    );

    for (const record of records) {
      record.status = 'aborted';
      await this.save(record);
    }
  }

  async publish(
    operation: SermasRecordChangedOperation,
    record: DialogueTaskRecordDto,
  ) {
    const ev: DialogueTaskRecordChangedDto = {
      appId: record.appId,
      operation,
      record,
    };
    await this.asyncApi.recordChanged(ev);
    this.emitter.emit('task.record.changed', ev);
  }

  async save(task: DialogueTaskRecordDto) {
    const exists = await this.load(task.recordId);
    const doc = exists ? exists : new this.taskRecord(task);

    for (const field in task) {
      doc[field] = task[field];
    }

    if (!doc.recordId) doc.recordId = uuidv4();

    doc.updated = new Date();

    await doc.save();

    const dto = toDTO<DialogueTaskRecordDto>(doc);
    await this.publish(exists ? 'created' : 'updated', dto);

    return dto;
  }

  async load(recordId?: string): Promise<DialogueTaskRecordDocument> {
    if (!recordId) return null;
    return await this.taskRecord.findOne({ recordId });
  }

  async read(recordId: string, errorIfNotFound = true) {
    const doc = await this.load(recordId);
    if (!doc && errorIfNotFound) {
      throw new NotFoundException(`Task ${recordId} not found`);
    }
    return doc ? toDTO(doc) : doc;
  }

  async remove(recordId: string) {
    try {
      if (!recordId) return;

      const dto = await this.read(recordId, false);
      if (!dto) return;

      this.logger.debug(`Removing recordId=${recordId}`);

      await this.taskRecord.deleteOne({ recordId });
      await this.publish('deleted', dto);
    } catch (e) {
      this.logger.error(`Failed to remove recordId=${recordId}: ${e.stack}`);
    }
  }

  async search(q: FilterQuery<DialogueTaskRecord>) {
    const records = await this.taskRecord.find(q).exec();
    return (records || []).map((t) => toDTO<DialogueTaskRecordDto>(t));
  }
}
