import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BadRequestException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import {
  PlatformAppDto,
  ToolsRequestSchema,
  ToolsRequestSchemaAuthBearer,
} from 'apps/platform/src/app/platform.app.dto';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { PlatformKeycloakService } from 'apps/platform/src/platform.keycloack.service';
import axios, { AxiosError, AxiosRequestConfig, isAxiosError } from 'axios';
import { DialogueToolsAsyncApiService } from '../dialogue.tools.async.service';
import { DialogueToolTriggeredEventDto } from '../dialogue.tools.dto';
import { ToolTriggerEventDto } from './dialogue.tools.trigger.dto';

@Injectable()
export class DialogueToolsTriggerService {
  private readonly logger = new Logger(DialogueToolsTriggerService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService,

    private readonly platformAppService: PlatformAppService,
    private readonly platformKeycloakService: PlatformKeycloakService,

    private readonly dialogueToolsAsyncApiService: DialogueToolsAsyncApiService,
  ) {}

  onAgentToolRequest(payload: DialogueToolTriggeredEventDto) {
    this.dialogueToolsAsyncApiService.toolTriggered(payload);
  }

  async onTrigger(ev: ToolTriggerEventDto) {
    try {
      await this.trigger(ev);
    } catch (e) {
      this.logger.error(`Tool ${ev.name} trigger failed: ${e.stack}`);
    }
  }

  async trigger(payload: ToolTriggerEventDto) {
    const { appId, sessionId, schema, values } = payload;
    this.logger.log(
      `Trigger tool '${schema.description}' name=${payload.name} appId=${payload.appId} sessionId=${payload.sessionId}`,
    );

    const app = await this.platformAppService.readApp(appId);
    if (!app) {
      this.logger.warn(`appId=${appId} not found`);
      return;
    }

    const ev: DialogueToolTriggeredEventDto = {
      appId,
      sessionId,
      name: schema.name,
      tool: {
        ...schema,
        // set the actual value detected by LLM
        schema: (schema.schema || []).map((srcParam) => {
          const param = { ...srcParam };
          // if value is already set, do not override
          if (
            !param.value &&
            param.ignore !== true &&
            values[param.parameter] !== undefined
          ) {
            param.value = values[param.parameter];
          }
          return param;
        }),
      },
    };

    this.emitter.emit('agent.tools.request', ev);

    if (!schema.request) return;

    this.logger.debug(
      `[${schema.name}] performing request to ${schema.request?.url}`,
    );

    let apiConfig: AxiosRequestConfig;
    try {
      apiConfig = await this.getAuthConfig(app, schema.request);
    } catch (e) {
      this.logger.warn(
        `[${schema.name}] Failed to retrieve configured auth settings: ${e.stack}`,
      );

      this.emitter.emit('agent.tools.failed', {
        reason: 'auth',
        params: values,
        appId,
        name: schema.name,
        error: e,
      });
    }

    let result = '';
    if (schema.request?.url) {
      let url = schema.request.url;
      // try to substitue :[paramKey] with the value
      for (const key in values) {
        url = url.replace(`:${key}`, values[key]);
      }
      url = url.replace(`:appId`, appId);
      if (url.substring(0, 1) === '/') {
        const baseUrl =
          this.config.get('API_URL_INTERNAL') ||
          this.config.get('API_URL') ||
          'http://127.0.0.1:3000/api';
        url = `${baseUrl}${url}`;
      }
      this.logger.debug(`[${schema.name}] Calling ${url}`);
      try {
        const res = await axios({
          ...apiConfig,
          method: 'POST',
          url,
          data: { ...values, appId },
        });
        result = res.data;
      } catch (e: any) {
        this.logger.warn(`[${schema.name}] request failed ${e.stack}`);
        this.emitter.emit('agent.tools.failed', {
          reason: 'request',
          params: values,
          appId,
          name: schema.name,
          error: e,
        });
        result = `Sorry, I cannot complete your request.`;
      }

      this.emitter.emit('agent.tools.result', {
        name: schema.name,
        result: result,
        params: values,
        appId: appId,
      });
    }

    this.logger.warn(`[${schema.name}] request completed: ${result}`);

    return result;
  }

  async getAccessToken(config: ToolsRequestSchemaAuthBearer): Promise<string> {
    if (!config) throw new Error(`Missing bearer configurations`);
    if (!config.clientType) throw new Error(`missing bearer.clientType`);
    let data;
    switch (config.clientType) {
      case 'password':
        if (!config.username)
          throw new Error(`missing bearer.username for ${config.clientType}`);
        if (!config.password)
          throw new Error(`missing bearer.password for ${config.clientType}`);

        data = {
          username: config.username,
          password: config.password,
          audience: config.audience,
          grant_type: 'password',
        };
        break;
      case 'client_credentials':
        if (!config.clientId)
          throw new Error(`missing bearer.clientId for ${config.clientType}`);
        if (!config.clientSecret)
          throw new Error(
            `missing bearer.clientSecret for ${config.clientType}`,
          );
        data = {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'client_credentials',
          audience: config.audience,
        };
        break;
      default:
        throw new Error(`unsupported bearer.clientType: ${config.clientType}`);
    }

    try {
      const res = await axios.post(config.tokenUrl, data);
      return res.data?.access_token;
    } catch (e: any) {
      this.logger.warn(`bearer request failed: ${e.stack}`);
      let axiosErr = '';
      if (isAxiosError(e)) {
        const err = e as AxiosError;
        axiosErr = ` code=${err.code} status=${err.status}`;
      }
      throw new Error(`request failed${axiosErr}`);
    }
  }

  async getAuthConfig(
    app: PlatformAppDto,
    config: ToolsRequestSchema,
  ): Promise<AxiosRequestConfig> {
    if (!config) return {};
    try {
      if (!config.auth) throw new Error('auth field is missing');
      if (config.auth === 'bearer') {
        const token = await this.getAccessToken(config.bearer);
        if (!token) throw new Error(`token is empty`);
        return {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };
      } else if (config.auth === 'basic') {
        if (!config.basic?.username) throw new Error(`missing basic.username`);
        if (!config.basic?.password) throw new Error(`missing basic.password`);

        return {
          auth: {
            username: config.basic.username,
            password: config.basic.password,
          },
        };
      } else if (config.auth === 'module') {
        if (!config.moduleId) throw new Error(`moduleId is missing`);
        const filtered = app.clients.filter(
          (client) => client.clientId === config.moduleId,
        );

        if (filtered.length) {
          try {
            const token =
              await this.platformKeycloakService.getAppClientAccessToken(
                app.appId,
                filtered[0].clientId,
              );
            return {
              headers: {
                Authorization: `Bearer ${token?.access_token}`,
              },
            };
          } catch (e: any) {
            throw new Error(
              `failed to obtain a token for module ${config.moduleId}`,
            );
          }
        } else throw new Error(`module client ${config.moduleId} not found`);
      } else throw new Error(`auth ${config.auth} not supported`);
    } catch (e: any) {
      this.logger.warn(`auth configuration failed: ${e.stack}`);
      throw new BadRequestException(
        `Failed to obtain auth configuration for auth type '${
          config.auth || ''
        }': ${e.message}`,
      );
    }
  }
}
