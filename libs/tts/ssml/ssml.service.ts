import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LanguageCode } from 'libs/language/lang-codes';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { Emotion } from 'libs/sermas/sermas.dto';
import { ssmlPrompt } from './ssml.prompt';
import { SessionContext } from 'apps/session/src/session.context';

export class SSMLParams {
  text: string;
  emotion?: Emotion;
  language: LanguageCode;
  context?: string;
}

@Injectable()
export class SSMLService {
  private readonly logger = new Logger(SSMLService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly llmProvider: LLMProviderService,
  ) {}

  async generate(params: SSMLParams, sessionContext?: SessionContext) {
    if (!params.text) return params.text;

    try {
      const res = await this.llmProvider.chat({
        stream: false,
        json: false,
        system: ssmlPrompt(params),
        user: params.text,
        tag: 'tasks',
        sessionContext,
      });

      if (!res) return params.text;

      let ssml = res;
      if (ssml.startsWith('```xml')) {
        ssml = ssml.replace(/^```xml/, '');
        if (ssml.endsWith('```')) {
          ssml.replace(/```$/, '');
        }
      }

      if (this.config.get('SSML_PRINT') === '1')
        ssml.split('\n').forEach((line) => this.logger.debug(`SSML | ${line}`));

      return ssml;
    } catch (e: any) {
      this.logger.warn(`Failed to generate SSML: ${e.stack}`);
      return params.text;
    }
  }
}
