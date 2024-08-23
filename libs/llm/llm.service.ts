import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import OpenAI, { ClientOptions } from 'openai';
import { LLMParams } from './llm.dto';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

  private openaiClient: OpenAI;
  private readonly params: LLMParams;

  constructor(private readonly config: ConfigService) {
    this.params = this.loadOpenAIParams();
  }

  getOpenAIClient() {
    if (!this.openaiClient) {
      this.openaiClient = this.createOpenAIClient();
    }
    return this.openaiClient;
  }

  getOpenAIParams() {
    return this.params;
  }

  protected loadOpenAIParams(): LLMParams {
    return {
      modelName: this.config.get('OPENAI_MODEL') || undefined,
      baseURL: this.config.get('OPENAI_BASEURL') || undefined,
      apiKey: this.config.get('OPENAI_API_KEY') || undefined,
    };
  }

  createOpenAIClient(params?: ClientOptions): OpenAI | undefined {
    const { apiKey, baseURL } = this.params;

    params = params || {};
    params.apiKey = params.apiKey || apiKey;
    if (baseURL) params.baseURL = baseURL;

    if (!params.apiKey && !process.env.OPENAI_API_KEY) {
      this.logger.error(
        `OpenAI api key is missing. Set it via env OPENAI_API_KEY or provide as parameter on client initialization`,
      );
      return undefined;
    }

    return new OpenAI(params);
  }
}
