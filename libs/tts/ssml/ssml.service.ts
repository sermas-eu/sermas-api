import { Injectable, Logger } from '@nestjs/common';
import { LLMProviderService } from 'libs/llm/llm.provider.service';

@Injectable()
export class SSMLService {
  private readonly logger = new Logger(SSMLService.name);

  constructor(private readonly llmProvider: LLMProviderService) {}

  async generate(text: string, emotion: string) {
    try {
      let systemPrompt =
        'Convert the user text to SSML compliant format. Answer exclusively with the SSML markup.';

      if (emotion) {
        systemPrompt += ` Consider the detected user emotion "${emotion}" to provide a more emphatic response.`;
      }

      const res = await this.llmProvider.chat({
        stream: false,
        json: false,
        system: systemPrompt,
        message: text,
        tag: 'translation',
      });

      this.logger.debug(
        `Generated SSML content for emotion=${emotion}: ${res}`,
      );

      return res;
    } catch (e: any) {
      this.logger.warn(`Failed to generate SSML: ${e.stack}`);
    }
  }
}
