import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { toDTO } from 'libs/util';
import { FilterQuery, Model } from 'mongoose';
import { DialogueToolsRepositoryRecordDto } from './dialogue.tools.repository.dto';
import { DialogueToolsRepository } from './dialogue.tools.repository.schema';

@Injectable()
export class DialogueToolsRepositoryService {
  private readonly logger = new Logger(DialogueToolsRepositoryService.name);

  constructor(
    @InjectModel(DialogueToolsRepository.name)
    private repository: Model<DialogueToolsRepository>,
  ) {}

  async save(data: DialogueToolsRepositoryRecordDto) {
    if (!data.repositoryId)
      throw new BadRequestException(`Missing repositoryId`);

    const exists = await this.load(data.repositoryId);

    const record = exists || new this.repository(data);

    for (const key in data) {
      record[key] = data[key];
    }

    await record.save();

    return toDTO<DialogueToolsRepositoryRecordDto>(record);
  }

  async remove(repositoryId: string) {
    if (!repositoryId) return;
    await this.repository.deleteOne({ repositoryId });
  }

  load(repositoryId: string) {
    return this.repository.findOne({ repositoryId });
  }

  async read(repositoryId: string, errorIfNotExists = false) {
    const record = await this.load(repositoryId);
    if (!record && errorIfNotExists)
      throw new NotFoundException(`tools id=${repositoryId} not found`);

    return record ? toDTO<DialogueToolsRepositoryRecordDto>(record) : null;
  }

  async search(filter: FilterQuery<DialogueToolsRepository>) {
    const results = await this.repository.find(filter);
    return results.map((r) => toDTO<DialogueToolsRepositoryRecordDto>(r));
  }
}
