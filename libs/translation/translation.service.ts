import { Injectable, Logger } from '@nestjs/common';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { ITranslate } from './itranslate';
import { detectionPrompt, translationPrompt } from './translation.prompt';
import { SessionContext } from 'apps/session/src/session.context';

@Injectable()
export class LLMTranslationService implements ITranslate {
  private readonly logger = new Logger(LLMTranslationService.name);

  constructor(
    private readonly llmProvider: LLMProviderService,
    private readonly monitor: MonitorService,
  ) {}

  async detect(text: string, sessionContext?: SessionContext) {
    if (!text) return null;

    const perf = this.monitor.performance({
      label: 'translation-detect',
    });

    try {
      const language = await this.llmProvider.chat({
        system: detectionPrompt(),
        user: text,
        stream: false,
        tag: 'translation',
        sessionContext,
      });
      perf();
      return language === 'unknown' ? null : language;
    } catch (e) {
      this.logger.warn(`language detection failed: ${e.stack}`);
    }
    return null;
  }

  async translate(
    text: string,
    fromLanguage: string,
    toLanguage: string,
    sessionContext?: SessionContext,
  ): Promise<string> {
    fromLanguage = fromLanguage || '';

    if (!text) return text;
    if (!toLanguage) return text;

    if (fromLanguage.toLowerCase() === toLanguage.toLowerCase()) {
      return text;
    }

    const perf = this.monitor.performance({
      label: 'translation-translate',
    });

    try {
      const translation = await this.llmProvider.chat({
        system: translationPrompt({
          fromLanguage,
          toLanguage,
        }),
        user: text,
        stream: false,
        sessionContext,
      });

      perf();

      return translation;
    } catch (e) {
      this.logger.warn(`Translation failed: ${e.stack}`);
      return text;
    }
  }
}
