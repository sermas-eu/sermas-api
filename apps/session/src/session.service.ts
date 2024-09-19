import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import {
  InteractionType,
  UserDetectionEventDto,
  UserInteractionIntentionDto,
} from 'apps/detection/src/detection.dto';
import { RepositoryAvatarDefault } from 'apps/platform/src/app/platform.app.defaults';
import {
  AppSettingsDto,
  LLMSettingsDto,
  RepositoryAvatarDto,
} from 'apps/platform/src/app/platform.app.dto';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { UIInteractionEventDto } from 'apps/ui/src/ui.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { DefaultLanguage } from 'libs/language/lang-codes';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { isDate, isNodeEnv, toDTO } from 'libs/util';
import { FilterQuery, Model } from 'mongoose';

import { v4 as uuidv4 } from 'uuid';
import { AgentChangedDto } from './agent/session.agent.dto';
import { SessionAgentService } from './agent/session.agent.service';
import { SessionAsyncApiService } from './session.async.service';
import {
  SessionChangedDto,
  SessionDto,
  SessionSearchFilter,
  UserReferenceDto,
} from './session.dto';
import { Session, SessionDocument } from './session.schema';

type SessionEventHandlerPayload = {
  appId: string;
  sessionId?: string;
  userId?: string;
  moduleId?: string;
  settings?: Partial<AppSettingsDto>;
};

type SessionContext = { appId: string; sessionId?: string };

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private sessionExpirationThreshold = 5 * 60 * 1000; // seconds

  private sessionLock: { [sessionId: string]: Promise<void> | undefined } = {};

  private async lock(sessionId: string, promise: Promise<any>) {
    if (this.sessionLock[sessionId]) {
      await this.sessionLock[sessionId];
    }
    this.sessionLock[sessionId] = promise;
    await promise;
  }

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<Session>,
    private readonly asyncApi: SessionAsyncApiService,
    private readonly agent: SessionAgentService,
    private readonly platformApp: PlatformAppService,
    private readonly emitter: EventEmitter2,
    private readonly broker: MqttService,
  ) {}

  @Interval(10 * 1000)
  async checkSessionExpiration(): Promise<void> {
    if (isNodeEnv('test')) return;

    const fiveMinutesAgo = new Date(
      Date.now() - this.sessionExpirationThreshold,
    );

    const sessions: SessionDocument[] = await this.sessionModel.aggregate([
      {
        $match: {
          modifiedAt: { $lt: fiveMinutesAgo },
          closedAt: null,
        },
      },
    ]);

    for (const session of sessions) {
      const interactionIntentionEvent: UserInteractionIntentionDto = {
        appId: session.appId,
        sessionId: session.sessionId,
        moduleId: 'api',
        interactionType: InteractionType.stop,
        probability: 1,
        source: 'system',
        ts: new Date(),
      };

      this.broker.publish(
        SermasTopics.detection.interactionIntention,
        interactionIntentionEvent,
      );

      session.closedAt = new Date();
      await this.update(session);

      this.logger.log(
        `Session sessionId=${session.sessionId} expired after ${
          this.sessionExpirationThreshold / 1000
        }s`,
      );
    }
  }

  async search(appId: string, filter: SessionSearchFilter) {
    if (!appId) return [];
    const q: FilterQuery<SessionDocument> = {
      appId,
    };

    if (filter.query) {
      if (filter.query.from) {
        if (!isDate(filter.query.from))
          throw new BadRequestException(`query.from is not a valid date`);
        q.createdAt = {
          $gte: new Date(filter.query.from),
        };
      }
      if (filter.query.to) {
        if (!isDate(filter.query.to))
          throw new BadRequestException(`query.to is not a valid date`);
        q.closedAt = {
          $lte: new Date(filter.query.to),
        };
      }
    }

    const query = this.sessionModel
      .find(q)
      .limit(filter.limit || 100)
      .skip(filter.skip || 0)
      .sort(filter.sort || { createdAt: 'desc' });
    const results = await query.exec();
    return results.map((r) => toDTO<SessionDto>(r));
  }

  async getLanguage(payload: SessionContext, useDefault = true) {
    const settings = await this.getSettings(payload);
    if (settings && settings.language) return settings.language;
    if (useDefault) return DefaultLanguage;
    return null;
  }

  async getSettings(
    payload: SessionContext,
  ): Promise<Partial<AppSettingsDto> | null> {
    try {
      const app = await this.platformApp.readApp(payload.appId, true);

      let settings: Partial<AppSettingsDto> = app ? app.settings || {} : {};

      let sessionId = payload.sessionId;
      if (!sessionId) {
        const data = payload as any;
        if (data.record?.sessionId) sessionId = data.record?.sessionId;
      }

      if (sessionId) {
        const session = await this.read(sessionId, false);
        if (session && session?.settings) {
          settings = {
            ...settings,
            ...session.settings,
          };
        }
      }

      return settings;
    } catch (e: any) {
      this.logger.error(
        `Failed to load settings for sessionId=${payload.sessionId} sessionId=${payload.appId}: ${e.message}`,
      );
    }
    return null;
  }

  async getLLM(sessionId: string): Promise<LLMSettingsDto> {
    const session = await this.read(sessionId, false);
    if (!session) return undefined;
    return session.settings?.llm || undefined;
  }

  async getAvatar(
    payload: SessionContext,
    avatarId?: string,
    useDefault = true,
  ): Promise<RepositoryAvatarDto | null> {
    try {
      const app = await this.platformApp.readApp(payload.appId, true);

      if (
        !app ||
        !app?.repository ||
        !app?.repository?.avatars ||
        !app?.repository?.avatars.length
      )
        return useDefault ? RepositoryAvatarDefault : null;

      const avatarRepository = app.repository.avatars;
      const defaultAvatar = avatarRepository[0];
      const settings = await this.getSettings(payload);

      avatarId = avatarId || settings.avatar;

      // pick the first available
      if (!avatarId) {
        return defaultAvatar;
      }

      const filtered = avatarRepository.filter((a) => a.id === avatarId);
      if (!filtered.length) return defaultAvatar;

      return filtered[0];
    } catch (e: any) {
      this.logger.error(
        `Failed to load avatar for sessionId=${payload.sessionId} sessionId=${payload.appId}: ${e.message}`,
      );
    }

    return useDefault ? RepositoryAvatarDefault : null;
  }

  async publishSessionChange(
    session: Partial<SessionDto | SessionDocument>,
    operation: SermasRecordChangedOperation,
  ): Promise<void> {
    const sessionChangedEvent: SessionChangedDto = {
      appId: session.appId,
      operation,
      record: toDTO(session),
      ts: new Date(),
    };

    this.emitter.emit('session.changed', sessionChangedEvent);
    this.asyncApi.sessionChanged(sessionChangedEvent);
  }

  async load(sessionId: string): Promise<SessionDocument | null> {
    const session = await this.sessionModel.findOne({ sessionId }).exec();
    return session ? session : null;
  }

  async getUserSession(appId: string, userId: string) {
    // this.logger.debug(`Get session sessionId=${userId}`);
    const session = await this.sessionModel
      .findOne({
        appId,
        $and: [{ userId }, { closedAt: null }],
      })
      .sort({
        modifiedAt: -1,
      })
      .exec();
    if (!session) throw new NotFoundException();
    return toDTO<SessionDto>(session);
  }

  async read(sessionId: string, failIfNotFound = true) {
    // this.logger.debug(`Get session sessionId=${sessionId}`);
    const session = await this.load(sessionId);
    if (!session) {
      if (failIfNotFound) throw new NotFoundException();
      return null;
    }
    return toDTO<SessionDto>(session);
  }

  async delete(sessionId: string): Promise<void> {
    this.logger.debug(`Delete session id=${sessionId}`);
    const session = await this.read(sessionId);
    await this.sessionModel.deleteOne({ sessionId }).exec();
    await this.publishSessionChange(session, 'deleted');
  }

  async create(session?: Partial<SessionDto>): Promise<SessionDto> {
    if (!session.appId) throw new BadRequestException('Missing appId');
    if (!session.agentId) throw new BadRequestException('Missing agentId');
    // if (!session.sessionId) throw new BadRequestException('Missing sessionId');

    session = session || ({} as SessionDto);

    if (session.sessionId) {
      const exists = await this.load(session.sessionId);
      if (exists) {
        this.logger.warn(
          `Reusing session sessionId=${session.sessionId} exists appId=${session.appId}`,
        );
        exists.closedAt = undefined;
        exists.modifiedAt = new Date();
        await exists.save();
        return toDTO(exists);
      }
    }

    const app = await this.platformApp.readApp(session.appId, false);

    const newSession = new this.sessionModel({
      agentId: session.agentId,
      sessionId: session.sessionId || uuidv4(),
      user: session.user || null,
      createdAt: session.createdAt || new Date(),
      modifiedAt: session.modifiedAt || new Date(),
      appId: session.appId,
      userId: session.userId,
      settings: session.settings || app?.settings || {},
    });

    this.logger.log(`Creating session sessionId=${newSession.sessionId}`);
    await newSession.save();
    await this.publishSessionChange(newSession, 'created');

    return toDTO(newSession);
  }

  async update(session: Partial<SessionDto>): Promise<SessionDto> {
    if (!session.sessionId) throw new BadRequestException('Missing sessionId');

    const sessionRecord = await this.load(session.sessionId);
    if (!sessionRecord) throw new NotFoundException(`session not found`);

    // TODO can we do this ?
    if (session.appId && session.appId !== sessionRecord.appId)
      throw new BadRequestException(`Cannot change appId`);

    if (session.closedAt) sessionRecord.closedAt = session.closedAt;
    if (session.user) sessionRecord.user = session.user;
    if (session.userId) sessionRecord.userId = session.userId;
    if (session.settings) {
      sessionRecord.settings = session.settings as AppSettingsDto;
    }

    sessionRecord.modifiedAt = new Date();

    await sessionRecord.save();
    await this.publishSessionChange(sessionRecord, 'updated');

    this.logger.verbose(
      `Updated sessionId=${session.sessionId} appId=${session.appId} modifiedAt=${sessionRecord.modifiedAt}`,
    );

    return toDTO(sessionRecord);
  }

  async getCurrentSession(
    appId: string,
    sessionId = null,
  ): Promise<SessionDto | null> {
    const filter = sessionId
      ? { appId, sessionId, closedAt: null }
      : { appId, closedAt: null };
    const session = await this.sessionModel.findOne(filter);
    return session ? toDTO(session) : null;
  }

  async updateSessionSettings(
    session: SessionDto,
    settings: Partial<AppSettingsDto>,
  ) {
    if (!session.settings) {
      const app = await this.platformApp.readApp(session.appId, false);
      if (app) {
        session.settings = { ...app.settings };
      }
    }

    if (settings) {
      for (const key in settings) {
        session.settings[key] =
          settings[key] === undefined ? session.settings[key] : settings[key];
      }
    }
  }

  async handleSessionFromEvent(ev: SessionEventHandlerPayload) {
    if (!ev.appId) return;

    return await this.lock(
      ev.sessionId,
      (async (): Promise<boolean | null> => {
        try {
          const currentSession = await this.getCurrentSession(
            ev.appId,
            ev.sessionId,
          );
          if (currentSession) {
            //update session for appId
            currentSession.userId = ev.userId || currentSession.userId;

            await this.updateSessionSettings(currentSession, ev.settings);
            await this.update(currentSession);
            return true;
          }
        } catch (e: any) {
          this.logger.error(
            `Failed to update sessionId=${ev.sessionId} appId=${ev.appId}: ${e.message}`,
          );
          this.logger.debug(e.stack);
          return null;
        }

        if (ev.moduleId) {
          try {
            const moduleId = ev.moduleId;
            await this.createFromEvent({
              ...ev,
              moduleId,
            });
          } catch (e: any) {
            this.logger.error(
              `Failed to create session moduleId=${ev.moduleId} sessionId=${ev.sessionId} appId=${ev.appId}: ${e.message}`,
            );
            this.logger.debug(e.stack);
            return null;
          }
        }
      })(),
    );
  }

  async clear() {
    await this.sessionModel.deleteMany({});
  }

  async createFromEvent(ev: {
    appId: string;
    moduleId: string;
    sessionId?: string;
    userId?: string;
    settings?: Partial<AppSettingsDto>;
  }) {
    let user: UserReferenceDto[] = undefined;
    if (ev.userId) {
      user = [
        {
          source: 'account',
          userId: ev.userId,
        },
      ];
    }

    if (!ev.appId) {
      this.logger.error(`Cannot create session, appId is missing`);
      return;
    }

    const agent = await this.agent.getByModuleId(ev.appId, ev.moduleId);

    if (!agent) {
      this.logger.error(`Failed to find agent for module=${ev.moduleId}`);
      return;
    }

    const session = await this.create({
      agentId: agent.agentId,
      appId: ev.appId,
      sessionId: ev.sessionId || uuidv4(),
      user,
      userId: ev.userId,
      settings: ev.settings,
    });

    this.logger.verbose(
      `Created a new session on first interaction sessionId=${session.sessionId} appId=${ev.appId} userId=${ev.userId}`,
    );
  }

  async onUserDetection(payload: UserDetectionEventDto) {
    await this.handleSessionFromEvent(payload);
  }

  async onInteractionIntention(
    payload: UserInteractionIntentionDto,
  ): Promise<void> {
    this.logger.debug(`Interaction event: ${JSON.stringify(payload)}`);
  }

  async onDialogueMessage(ev: DialogueMessageDto) {
    const settings: Partial<AppSettingsDto> = {
      language: ev.language,
      avatar: ev.avatar,
      llm: ev.llm,
      ttsEnabled: ev.ttsEnabled,
    };

    await this.handleSessionFromEvent({
      ...ev,
      moduleId: 'avatar',
      settings: ev.actor === 'user' ? settings : {},
    });
  }

  async onUIInteraction(ev: UIInteractionEventDto) {
    if (!ev.moduleId) return;

    if (ev.interaction.element !== 'ui' || ev.interaction.value !== 'ready')
      return;

    await this.handleSessionFromEvent(ev);
  }

  async onAgentChanged(ev: AgentChangedDto) {
    if (ev.record.status !== 'ready') return;

    const moduleId =
      ev.moduleId || ev.record.modules.length
        ? ev.record.modules[0].moduleId
        : undefined;

    await this.handleSessionFromEvent({
      ...ev,
      moduleId,
      settings: ev.settings,
    });
  }
}
