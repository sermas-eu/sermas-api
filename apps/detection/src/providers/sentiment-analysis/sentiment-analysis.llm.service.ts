import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionContext } from 'apps/session/src/session.context';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { Emotion, EmotionTypes } from 'libs/sermas/sermas.dto';
import { SentimentAnalysisResult } from './sentiment-analysis.dto';
import { sentimentAnalysisPrompt } from './sentiment-analysis.prompt';

@Injectable()
export class ChatGPTSentimentAnalysisService implements OnModuleInit {
  private readonly logger = new Logger(ChatGPTSentimentAnalysisService.name);
  private readonly apiToken;

  constructor(
    private readonly llmProvider: LLMProviderService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get('SENTIMENT_ANALYSIS') === '0') {
      this.logger.warn(
        'Sentiment analysis disabled, enable with SENTIMENT_ANALYSIS',
      );
    }
  }

  async analyse(
    message: string,
    sessionContext?: SessionContext,
  ): Promise<SentimentAnalysisResult | null> {
    if (this.config.get('SENTIMENT_ANALYSIS') === '0') {
      return null;
    }
    await this.progressService.dialogueProgress({ event: 'analyze' });

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
