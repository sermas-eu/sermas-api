import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PlatformKeycloakService } from '../../platform.keycloack.service';
import { PlatformTopicsService } from '../../topics/platform.topics.service';
import { AppClientDto } from '../platform.app.dto';
import { PlatformAppService } from '../platform.app.service';
import { uuidv4 } from 'libs/util';

@Injectable()
export class PlatformAppClientService {
  private readonly logger = new Logger(PlatformAppClientService.name);

  constructor(
    private readonly keycloack: PlatformKeycloakService,
    private readonly app: PlatformAppService,
    private readonly topics: PlatformTopicsService,
  ) {}

  async createClient(data: Partial<AppClientDto>): Promise<AppClientDto> {
    if (!data.appId) throw new BadRequestException('Missing appId');

    if (!data.permissions || !data.permissions.length) data.permissions = ['*'];

    const app = await this.app.loadApp(data.appId);
    if (!app) throw new NotFoundException('app not found');

    app.clients = app.clients || [];

    const clientId = data.clientId || uuidv4();

    if (app.clients.filter((c) => c.clientId === clientId).length)
      throw new BadRequestException(`Client ${clientId} already exists`);

    // if (data.clientId) {
    //   const exists = app.clients
    //     .map((c, i) => (c.clientId === clientId ? i : null))
    //     .filter((c) => c === null);
    //   if (exists.length) {
    //     const i = exists[0];
    //     app.clients.splice(i, 1);
    //     await this.keycloack.removeClient(data.appId, clientId);
    //   }
    // }

    // create on keycloack
    const createdClient = await this.keycloack.saveAppModuleClient({
      name: data.name,
      appId: data.appId,
      clientId,
      permissions: data.permissions,
    });

    const client: AppClientDto = {
      appId: data.appId,
      name: data.name,
      clientId,
      secret: await this.keycloack.getClientSecret(
        data.appId,
        createdClient.clientId,
      ),
      permissions: data.permissions,
    };

    app.clients.push(client);
    await app.save();

    return client;
  }

  async updateClient(
    data: Partial<AppClientDto>,
    upsert = true,
  ): Promise<AppClientDto> {
    if (!data.appId) throw new BadRequestException('Missing appId');
    if (!data.clientId) throw new BadRequestException('Missing clientId');
    if (!data.permissions || !data.permissions.length)
      throw new BadRequestException('Missing permissions');

    const app = await this.app.loadApp(data.appId);
    if (!app) throw new NotFoundException('appId not found');

    app.clients = app.clients || [];
    const found = app.clients.filter(
      (c) => c.clientId === data.clientId,
    ).length;
    // if upsert, create if it does not exists
    if (!found && !upsert) throw new NotFoundException('clientId not found');

    // update keycloack
    await this.keycloack.removeAppModuleClient(data.appId, data.clientId);
    await this.keycloack.saveAppModuleClient({
      clientId: `${data.appId}-${data.clientId}`,
      permissions: data.permissions,
    });

    app.clients = app.clients.map((c) => {
      if (c.clientId === data.clientId) {
        c.permissions = data.permissions;
      }
      return c;
    });

    await app.save();

    const [client] = app.clients.filter((c) => c.clientId === data.clientId);

    return client;
  }

  async removeClient(appId: string, clientId: string): Promise<void> {
    if (!appId) throw new NotFoundException('appId not found');
    if (!clientId) throw new NotFoundException('clientId not found');

    const app = await this.app.loadApp(appId);
    if (!app) throw new NotFoundException('app not found');

    app.clients = app.clients || [];
    const found = app.clients.filter((c) => c.clientId === clientId);

    if (!found) throw new NotFoundException('client not found');

    app.clients = app.clients.filter((c) => c.clientId !== clientId);

    // remove on keycloack
    await this.keycloack.removeAppModuleClient(appId, clientId);

    await app.save();
  }

  async readClient(
    appId: string,
    compositeClientId: string,
  ): Promise<AppClientDto> {
    const app = await this.app.readApp(appId);

    const clientId = compositeClientId.replace(`${app.appId}-`, '');
    const found = (app.clients || []).filter((c) => c.clientId === clientId);
    if (!found.length) throw new NotFoundException('client not found');

    const [client] = found;
    client.appId = appId;

    client.secret = await this.keycloack.getClientSecret(appId, clientId);

    return client;
  }

  async listTopics(appId: string, clientId: string): Promise<string[]> {
    const client = await this.readClient(appId, clientId);

    const topics = this.topics.getTopicsList();
    const topicsTree = this.topics.toTree();

    const matches = client.permissions.reduce((list, p) => {
      const [resource, scope] = p.split('.');

      if (scope === '*') {
        list.push(...topicsTree[resource].map((s) => `${resource}/${s}`));
      } else {
        list.push(`${resource}/${scope}`);
      }

      return list;
    }, []);

    return topics.filter((topic) => {
      const [, , resource, scope] = topic.split('/');
      return matches.includes(`${resource}/${scope}`);
    });
  }
}
