import { Injectable, Logger } from '@nestjs/common';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { ITranslate } from './itranslate';

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
        message: text,
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

    text.split('\n').forEach((line) => this.logger.verbose(`| ${line}`));

    try {
      const translation = await this.llmProvider.chat({
        system: `
Your task is to translate to language identified by code ${toLanguage}. ${
          fromLanguage
            ? 'Original language code is ' + fromLanguage
            : 'Please infer the original language of the text.'
        }.
Answer the user exclusively with the translated text, avoid any further reasoning. 
Keep the original text formatting. 
If you cannot translate, return the exact user text. 
Never add Notes or Explanations.`,
        message: text,
        stream: false,
      });

      perf('openai');

      translation
        .split('\n')
        .forEach((line) => this.logger.verbose(`| ${line}`));

      return translation;
    } catch (e) {
      this.logger.warn(`Translation failed: ${e.stack}`);
      return text;
    }
  }
}
