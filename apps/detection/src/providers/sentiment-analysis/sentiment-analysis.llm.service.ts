import { Injectable, Logger } from '@nestjs/common';
import { SessionContext } from 'apps/session/src/session.context';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { Emotion, EmotionTypes } from 'libs/sermas/sermas.dto';
import { SentimentAnalysisResult } from './sentiment-analysis.dto';
import { sentimentAnalysisPrompt } from './sentiment-analysis.prompt';

@Injectable()
export class ChatGPTSentimentAnalysisService {
  private readonly logger = new Logger(ChatGPTSentimentAnalysisService.name);
  private readonly apiToken;

  constructor(private readonly llmProvider: LLMProviderService) {}

  async analyse(
    message: string,
    sessionContext?: SessionContext,
  ): Promise<SentimentAnalysisResult | null> {
    const emotions = EmotionTypes.join(', ');
    const defaultEmotion: Emotion = 'neutral';

    type EmotionResponse = {
      emotion: Emotion;
      probability: number;
    };

    let content: EmotionResponse;
    try {
      content = await this.llmProvider.chat<EmotionResponse>({
        system: sentimentAnalysisPrompt({
          emotions,
          defaultEmotion,
        }),
        user: message,
        stream: false,
        json: true,
        tag: 'sentiment',
        sessionContext,
      });
    } catch (e) {
      this.logger.error(`Error calling LLM: ${e.message}`);
      this.logger.verbose(e.stack);
      return null;
    }

    if (!content || !content.emotion) {
      return null;
    }

    this.logger.verbose(
      `message=${message} emotion=${content.emotion} probability=${content.probability}`,
    );

    const matches = EmotionTypes.indexOf(content.emotion) > -1;
    return matches
      ? {
          emotion: {
            value: content.emotion,
            probability: +content.probability,
          },
        }
      : null;
  }
}
