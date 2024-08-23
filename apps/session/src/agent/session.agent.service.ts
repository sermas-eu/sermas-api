import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AppSettingsDto,
  PlatformAppChangedDto,
} from 'apps/platform/src/app/platform.app.dto';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import { uuidv4 } from 'libs/util';
import { AgentStatus, AgentStatusCodes } from '../session.dto';
import { SessionAgentAsyncApiService } from './session.agent.async.service';
import {
  AgentChangedDto,
  AgentDto,
  AgentHeartBeatEventDto,
} from './session.agent.dto';

@Injectable()
export class SessionAgentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionAgentService.name);

  private agents: Record<string, Record<string, AgentDto>> = {};

  constructor(
    private readonly asyncApi: SessionAgentAsyncApiService,
    private readonly platformApp: PlatformAppService,
  ) {}

  async onModuleInit() {
    await this.resetAgents();

    const apps = await this.platformApp.searchApps({});

    await Promise.all(
      apps.map(async (app) => {
        for (const mod of app.modules) {
          await this.createAgent(
            app.appId,
            {
              modules: [
                {
                  appId: app.appId,
                  moduleId: mod.moduleId,
                  status: 'not_ready',
                },
              ],
            },
            true,
          );
        }
      }),
    );
  }

  onModuleDestroy() {
    this.resetAgents();
  }

  resetAgents() {
    this.agents = {};
  }

  async publish(
    record: AgentDto,
    operation: SermasRecordChangedOperation,
    context?: {
      moduleId?: string;
      clientId?: string;
      sessionId?: string;
      userId?: string;
      settings?: AppSettingsDto;
    },
  ) {
    const { appId } = record;
    const { moduleId, clientId, sessionId, userId, settings } = context || {};

    const event: AgentChangedDto = {
      appId,
      clientId,
      sessionId,
      userId,
      moduleId,
      operation,
      record,
      settings,
      ts: new Date(),
    };
    this.asyncApi.agentChanged(event);
  }

  async getByModuleId(
    appId: string,
    moduleId: string,
  ): Promise<AgentDto | null> {
    if (!this.agents[appId]) {
      await this.createAgent(appId, {});
    }
    const agents = Object.values(this.agents[appId]).filter(
      (a) => a.modules.filter((m) => m.moduleId === moduleId).length > 0,
    );
    return agents.length ? agents[0] : null;
  }

  async getAgent(appId: string, agentId: string): Promise<AgentDto | null> {
    if (!this.agents[appId]) return null;
    return this.agents[appId][agentId] || null;
  }

  async getAgents(appId: string): Promise<Record<string, AgentDto>> {
    this.agents[appId] = this.agents[appId] || {};
    return this.agents[appId];
  }

  async onAgentHeartBeat(ev: AgentHeartBeatEventDto): Promise<AgentDto[]> {
    this.logger.log(
      `Received hearthbeat status=${ev.status} moduleId=${ev.moduleId}`,
    );

    const { appId } = ev;

    if (!appId)
      throw new BadRequestException('onAgentHeartBeat: Missing appId');

    this.agents[appId] = this.agents[appId] || {};

    const agents = Object.keys(this.agents[appId])
      .map((agentId) => {
        const agent = this.agents[appId][agentId];
        return agent.modules.filter((m) => m.moduleId === ev.moduleId).length
          ? agent
          : null;
      })
      .filter((a) => a !== null);

    // no module match, create a new agent
    if (!agents.length) {
      const agent = await this.createAgent(appId, {
        modules: [ev],
        status: ev.status,
      });
      agents.push(agent);
    }

    agents.map((agent) => {
      let hasChanges = false;
      const modules = (agent.modules || []).filter(
        (m) => m.moduleId === ev.moduleId,
      );
      if (!modules.length) {
        // module not found, add
        agent.modules.push(ev);
        this.logger.debug(
          `Added module ${ev.moduleId} to agent ${agent.agentId}`,
        );
        hasChanges = true;
      }

      // update modules status
      agent.modules = agent.modules.map((m) => {
        if (m.moduleId !== ev.moduleId) return m;
        this.logger.debug(`Updated module ${ev.moduleId}`);
        hasChanges = true;
        return { ...m, ...ev };
      });

      // update agent status
      const agentStatus: AgentStatus = agent.modules.filter(
        (m) => AgentStatusCodes[m.status] < 0,
      ).length
        ? 'not_ready'
        : 'ready';

      if (agent.status !== agentStatus) {
        agent.status = agentStatus;
        hasChanges = true;
      }

      if (hasChanges) {
        this.publish(agent, 'updated', ev);
      }
      return agent;
    });

    return agents;
  }

  async createAgent(
    appId: string,
    data: Partial<AgentDto>,
    skipPublish = false,
  ): Promise<AgentDto> {
    const { clientId } = data;
    const agent: AgentDto = {
      agentId: data.agentId || uuidv4(),
      appId,
      modules: data.modules || [],
      status: 'loading',
      clientId,
      ts: new Date(),
    };

    this.agents[appId] = this.agents[appId] || {};

    const exists = Object.values(this.agents[appId]).filter(
      (a) => a.modules.length === 0,
    );
    if (exists.length > 0) {
      // this.logger.debug(`Skip agent creation, an empty agent exists.`);
      return exists[0];
    }

    this.logger.debug(`Agent created agentId=${agent.agentId} appId=${appId}`);
    this.agents[appId][agent.agentId] = agent;

    if (!skipPublish) {
      this.publish(agent, 'created', data);
    }

    return agent;
  }

  async onAppChanged(payload: PlatformAppChangedDto) {
    const { operation, record: app, appId, clientId } = payload;

    this.logger.debug(
      `session.agent.onAppChanged operation=${operation} appId=${appId}`,
    );

    switch (operation) {
      case 'created':
        await this.createAgent(appId, { clientId });
        break;
      case 'deleted':
        if (this.agents[app.appId]) {
          Object.values(this.agents[app.appId]).forEach((agent) => {
            this.logger.warn(
              `Agent removed agentId=${agent.agentId} appId=${appId}`,
            );
            if (this.agents[app.appId][agent.agentId]) {
              delete this.agents[app.appId][agent.agentId];
            }
            this.publish(agent, 'deleted');
          });
        }

        this.agents[app.appId] = {};
        this.logger.warn(`All agents deleted for appId=${appId}`);
        break;
    }
  }
}
