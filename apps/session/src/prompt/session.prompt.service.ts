import { Injectable, Logger } from '@nestjs/common';
import { packAvatarObject } from 'apps/dialogue/src/avatar/utils';
import { DialogueVectorStoreService } from 'apps/dialogue/src/document/dialogue.vectorstore.service';
import { DialogueMemoryService } from 'apps/dialogue/src/memory/dialogue.memory.service';
import {
  AppSettingsDto,
  RepositoryAvatarDto,
} from 'apps/platform/src/app/platform.app.dto';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { createSessionContext } from '../session.context';
import { SessionService } from '../session.service';
import {
  AgentEvaluatePromptDto,
  AgentEvaluatePromptResponseDto,
} from './session.prompt.dto';
import {
  AgentEvaluatePromptParams,
  sessionPrompt,
} from './session.prompt.service.prompt';

@Injectable()
export class SessionPromptService {
  private readonly logger = new Logger(SessionPromptService.name);

  constructor(
    private readonly platformApp: PlatformAppService,
    private readonly session: SessionService,
    private readonly llm: LLMProviderService,
    private readonly memory: DialogueMemoryService,
    private readonly vectorStore: DialogueVectorStoreService,

    private readonly monitor: MonitorService,
  ) {}

  async prompt(payload: AgentEvaluatePromptDto) {
    const { appId, sessionId, provider, model, prompt } = payload;

    const json = payload.options?.json === true;

    const useDocuments = payload.options?.documents;
    let knowledge: string;
    if (useDocuments) {
      knowledge = await this.vectorStore.search(appId, prompt);
    }

    const useHistory = payload.options?.history;
    let history: string;
    if (useHistory) {
      history = await this.memory.getSummary(sessionId);
    }

    let settings: Partial<AppSettingsDto>;
    let avatar: RepositoryAvatarDto;

    const useAvatar = payload.options?.avatar;
    if (useAvatar) {
      avatar = await this.session.getAvatar(payload, useAvatar);
    }

    const useApp = payload.options?.app;
    if (useApp) {
      settings = await this.session.getSettings(payload);
    }

    const language = payload.options?.language || settings?.language;

    const params: AgentEvaluatePromptParams = {
      json,
      avatar: packAvatarObject(avatar),
      app: settings?.prompt?.text,
      history,
      language,
      knowledge,
    };

    const perf = this.monitor.performance({
      ...payload,
      label: 'session.prompt',
    });

    const result = await this.llm.send({
      stream: false,
      messages: [
        {
          role: 'system',
          content: sessionPrompt(params),
        },
        {
          role: 'user',
          content: payload.prompt,
        },
      ],
      json,
      provider,
      model,
      sessionContext: createSessionContext(payload),
    });

    perf();

    const res: AgentEvaluatePromptResponseDto = {
      format: json ? 'json' : 'text',
      result,
    };

    return res;
  }
}
