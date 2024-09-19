import { Injectable, Logger } from '@nestjs/common';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { ITranslate } from './itranslate';
import { translationPrompt } from './translation.prompt';

@Injectable()
export class LLMTranslationService implements ITranslate {
  private readonly logger = new Logger(LLMTranslationService.name);

  constructor(
    private readonly llmProvider: LLMProviderService,
    private readonly monitor: MonitorService,
  ) {}

  async detect(text: string) {
    if (!text) return null;

    const perf = this.monitor.performance({
      label: 'translation-detect',
    });

    try {
      const language = await this.llmProvider.chat({
        system: `Your task is to detect precisely the language as a two letter code.
Answer the user exclusively with the language code, avoid any further reasoning. If you cannot detect the language, return unknown. Never add Notes or Explanations.`,
        user: text,
        stream: false,
        tag: 'translation',
      });
      perf('openai');
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

    // text.split('\n').forEach((line) => this.logger.verbose(`| ${line}`));

    try {
      const translation = await this.llmProvider.chat({
        system: translationPrompt({
          fromLanguage,
          toLanguage,
        }),
        user: text,
        stream: false,
      });

      perf('openai');

      // translation
      //   .split('\n')
      //   .forEach((line) => this.logger.verbose(`| ${line}`));

      return translation;
    } catch (e) {
      this.logger.warn(`Translation failed: ${e.stack}`);
      return text;
    }
  }
}
