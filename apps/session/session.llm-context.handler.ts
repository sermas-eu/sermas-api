import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LLMSendArgs } from 'libs/llm/llm.provider.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { SessionService } from './src/session.service';

@Injectable()
export class SessionLLMContextHandlerService implements OnModuleInit {
  private readonly logger = new Logger(SessionLLMContextHandlerService.name);

  constructor(
    private readonly session: SessionService,
    private readonly llmProvider: LLMProviderService,
  ) {}

  onModuleInit() {
    // register to LLM provider to load session/app context related settings
    this.llmProvider.setSessionContextHandler(this);
  }

  async getChatServiceByTag(config: LLMSendArgs): Promise<string> {
    if (!config.tag) return;

    const sessionId = config.sessionContext?.sessionId;
    if (!sessionId) {
      // this.logger.debug('getChatServiceByTag: sessionId not set')
      return;
    }

    const session = await this.session.read(sessionId, false);
    if (!session) return;

    const sessionSettings = await this.session.getSettings(session);

    if (
      sessionSettings &&
      sessionSettings.llm &&
      sessionSettings.llm[config.tag]
    ) {
      this.logger.verbose(
        `Selected llm=${sessionSettings.llm[config.tag]} for tag=${config.tag} for sessionId=${session.sessionId}`,
      );
      return sessionSettings.llm[config.tag];
    }

    const appSettings = await this.session.getSettings({
      appId: session.appId,
    });

    if (appSettings && appSettings.llm && appSettings.llm[config.tag]) {
      this.logger.verbose(
        `Selected llm=${appSettings.llm[config.tag]} for tag=${config.tag} for appId=${session.appId}`,
      );
      return appSettings.llm[config.tag];
    }
  }
}
