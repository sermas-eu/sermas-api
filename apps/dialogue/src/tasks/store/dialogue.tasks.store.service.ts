import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import { toDTO, uuidv4 } from 'libs/util';
import { FilterQuery, Model } from 'mongoose';
import { DialogueTasksAsyncApiService } from '../dialogue.tasks.async.service';
import { DialogueTaskChangedDto } from '../dialogue.tasks.dto';
import { DialogueTaskDto } from './dialogue.tasks.store.dto';
import {
  DialogueTaskStore,
  DialogueTaskStoreDocument,
} from './dialogue.tasks.store.schema';

@Injectable()
export class DialogueTaskStoreService implements OnModuleInit {
  private readonly logger = new Logger(DialogueTaskStoreService.name);

  constructor(
    @InjectModel(DialogueTaskStore.name)
    private readonly tasks: Model<DialogueTaskStore>,
    private readonly asyncApi: DialogueTasksAsyncApiService,
    private readonly emitter: EventEmitter2,
  ) {}

  onModuleInit() {
    //
  }

  async publish(
    operation: SermasRecordChangedOperation,
    record: DialogueTaskDto,
  ) {
    const ev: DialogueTaskChangedDto = {
      appId: record.appId,
      operation,
      record,
    };
    await this.asyncApi.taskChanged(ev);
    this.emitter.emit('task.changed', ev);
  }

  async save(task: DialogueTaskDto) {
    const taskId = task.taskId || uuidv4();
    let doc = new this.tasks(task);
    let created = false;
    if (taskId) {
      const exists = await this.load(task.taskId);
      created = exists ? false : true;
      doc = exists || doc;
    }

    for (const field in task) {
      doc[field] = task[field];
    }

    await doc.save();

    const dto = toDTO<DialogueTaskDto>(doc);
    await this.publish(created ? 'created' : 'updated', dto);

    return dto;
  }

  async load(taskId?: string): Promise<DialogueTaskStoreDocument> {
    if (!taskId) return null;
    return await this.tasks.findOne({ taskId });
  }

  async read(taskId: string, errorIfNotFound = true) {
    const doc = await this.load(taskId);
    if (!doc && errorIfNotFound) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    return doc ? toDTO<DialogueTaskDto>(doc) : doc;
  }

  async remove(taskId: string) {
    try {
      if (!taskId) return;

      const dto = await this.read(taskId, false);
      if (!dto) return;

      this.logger.debug(`Removing task taskId=${taskId}`);

      await this.tasks.deleteOne({ taskId });
      await this.publish('deleted', dto);
    } catch (e) {
      this.logger.error(`Failed to remove taskId=${taskId}`);
    }
  }

  async search(q: FilterQuery<DialogueTaskStore>) {
    const tasks = await this.tasks.find(q).exec();
    return (tasks || []).map((t) => toDTO<DialogueTaskDto>(t));
  }
}
