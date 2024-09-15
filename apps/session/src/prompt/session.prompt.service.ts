import { Injectable, Logger } from '@nestjs/common';
import { DialogueVectorStoreService } from 'apps/dialogue/src/document/dialogue.vectorstore.service';
import { DialogueMemoryMessageDto } from 'apps/dialogue/src/memory/dialogue.memory.dto';
import { DialogueMemoryService } from 'apps/dialogue/src/memory/dialogue.memory.service';
import { RepositoryAvatarDto } from 'apps/platform/src/app/platform.app.dto';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { DefaultLanguage } from 'libs/language/lang-codes';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { SessionService } from '../session.service';
import {
  AgentEvaluatePromptDto,
  AgentEvaluatePromptResponseDto,
} from './session.prompt.dto';

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
    let history: DialogueMemoryMessageDto[] = [];
    if (useHistory) {
      history = await this.memory.getMessages(sessionId);
    }

    const app = await this.platformApp.readApp(appId, false);

    let avatarSettings: RepositoryAvatarDto;
    let appPrompt: string;
    if (app) {
      const useAvatar = payload.options?.avatar;
      if (useAvatar) {
        avatarSettings = await this.session.getAvatar(payload, useAvatar);
      }
      const useApp = payload.options?.app;
      if (useApp) {
        appPrompt = app.settings?.prompt?.text || '';
      }
    }

    const params: any = {
      appId: appId,
      language: payload.options?.language || DefaultLanguage,
      emotion: 'neutral',
      gender: avatarSettings?.gender
        ? avatarSettings?.gender === 'M'
          ? 'male'
          : 'female'
        : 'not defined',
      appPrompt,
      avatarPrompt: avatarSettings?.prompt,
      avatarName: avatarSettings?.name,
    };

    console.warn('****TODO********* session.prompt.service');

    const perf = this.monitor.performance({
      ...payload,
      label: 'session.prompt',
    });

    const result = await this.llm.send({
      stream: false,
      messages: [
        {
          role: 'user',
          content: payload.prompt,
        },
      ],
      json,
      provider,
      model,
    });

    perf();

    const res: AgentEvaluatePromptResponseDto = {
      format: json ? 'json' : 'text',
      result,
    };

    return res;
  }
}
