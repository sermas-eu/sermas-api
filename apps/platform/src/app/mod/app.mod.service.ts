import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import { AppModuleConfigDto } from '../platform.app.dto';
import { AppModuleConfig } from '../platform.app.schema';
import { PlatformAppService } from '../platform.app.service';
import { PlatformAppModuleAsyncApiService } from './app.mod.async.service';
import { uuidv4 } from 'libs/util';

@Injectable()
export class PlatformAppModuleService {
  private readonly logger = new Logger(PlatformAppModuleService.name);

  constructor(
    private readonly app: PlatformAppService,
    private readonly moduleAsync: PlatformAppModuleAsyncApiService,
  ) {}

  async getApp(appId: string) {
    if (!appId) throw new BadRequestException(`Missing appId`);
    const app = await this.app.loadApp(appId);
    if (!app) throw new NotFoundException();
    return app;
  }

  async getAppModule(appId: string, moduleId: string) {
    const app = await this.getApp(appId);
    const filtered = (app.modules || []).filter((m) => m.moduleId === moduleId);
    return filtered.length ? filtered[0] : null;
  }

  async saveModule(
    appId: string,
    data: AppModuleConfigDto,
    user?: AuthJwtUser,
  ) {
    if (!data) throw new BadRequestException(`Missing module`);

    const app = await this.getApp(appId);

    let exists = false;
    let mod: AppModuleConfig = { ...data };
    if (data.moduleId) {
      const prevMod = await this.getAppModule(appId, data.moduleId);
      if (prevMod) {
        mod = { ...prevMod, ...data };
        exists = true;
      }
    }

    mod.moduleId = data.moduleId || uuidv4();

    app.modules = app.modules || [];
    app.modules.push(mod);

    await this.app.updateApp({ data: app });
    this.publishChanged(appId, mod, exists ? 'updated' : 'created');

    this.logger.log(
      `${exists ? 'updated' : 'created'} moduleId=${
        mod.moduleId
      } appId=${appId}`,
    );

    return mod;
  }

  async removeModule(appId: string, moduleId: string, user?: AuthJwtUser) {
    const app = await this.getApp(appId);

    const filtered = (app.modules || [])
      .map((mod, i) => ({ mod, i }))
      .filter((m) => m.mod.moduleId === moduleId);

    if (!filtered.length) return;

    const { mod } = filtered[0];
    delete app.modules[filtered[0].i];

    await this.app.updateApp({ data: app });
    this.publishChanged(appId, mod, 'deleted');

    this.logger.log(`Removed moduleId=${mod.moduleId} appId=${appId}`);
  }

  async getModule(appId: string, moduleId: string, user?: AuthJwtUser) {
    if (!moduleId) throw new BadRequestException(`Missing moduleId`);

    const mod = await this.getAppModule(appId, moduleId);
    if (!mod) throw new NotFoundException(`module ${moduleId} not found`);

    return mod;
  }

  publishChanged(
    appId: string,
    record: AppModuleConfigDto,
    operation: SermasRecordChangedOperation,
  ) {
    this.moduleAsync.appModuleChanged({
      appId,
      ts: new Date(),
      operation,
      record,
    });
  }
}
