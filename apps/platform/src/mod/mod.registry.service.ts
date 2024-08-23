import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { loadFile, toDTO } from 'libs/util';
import { FilterQuery, Model } from 'mongoose';
import { PlatformModuleConfigDto } from './mod.dto';
import {
  PlatformModuleConfig,
  PlatformModuleConfigDocument,
} from './mod.schema';

@Injectable()
export class PlatformModuleRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PlatformModuleRegistryService.name);

  constructor(
    @InjectModel(PlatformModuleConfig.name)
    private modules: Model<PlatformModuleConfigDocument>,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.importModulesFromFile();
  }

  async importModulesFromFile(filepath?: string) {
    if (process.env.MODULES_IMPORT !== '1') return;

    filepath = filepath || this.config.get('MODULES_IMPORT_PATH');
    const modules = await loadFile<PlatformModuleConfigDto[]>(filepath, true);
    if (modules === null) {
      this.logger.debug(`Modules file ${filepath} not found or failed to load`);
      return;
    }
  }

  async save(data: PlatformModuleConfigDto) {
    const exists = await this.modules.findOne({ moduleId: data.moduleId });

    const mod = exists ? exists : new this.modules(data);

    for (const key in data) {
      mod[key] = data[key];
    }

    await mod.save();

    const dto = toDTO<PlatformModuleConfigDto>(mod);
    this.emitter.emit('platform.mod.save', dto);

    return dto;
  }

  async get(moduleId: string) {
    const mod = await this.modules.findOne({ moduleId });
    return mod ? toDTO<PlatformModuleConfigDto>(mod) : null;
  }

  list() {
    return this.find();
  }

  async find(q: FilterQuery<PlatformModuleConfig> = {}) {
    const modules = await this.modules.find(q);
    return modules.map((m) => toDTO<PlatformModuleConfigDto>(m));
  }

  async remove(moduleId: string) {
    this.emitter.emit('platform.mod.remove', moduleId);
    await this.modules.findOneAndDelete({ moduleId });
  }

  async removeAll() {
    await this.modules.deleteMany({});
    this.emitter.emit('platform.mod.clear');
  }
}
