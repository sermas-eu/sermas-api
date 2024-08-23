import { Injectable, Logger } from '@nestjs/common';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { Emotion, EmotionTypes } from 'libs/sermas/sermas.dto';
import { SentimentAnalysisResult } from './sentiment-analysis.dto';

@Injectable()
export class ChatGPTSentimentAnalysisService {
  private readonly logger = new Logger(ChatGPTSentimentAnalysisService.name);
  private readonly apiToken;

  constructor(private readonly llmProvider: LLMProviderService) {}

  // onModuleInit() {
  //   this.analyse({
  //     text: 'oggi non me ne va bene una, pessimo inizio',
  //     actor: 'user',
  //     appId: 'foo',
  //     language: 'it',
  //   });
  // }

  async analyse(message: string): Promise<SentimentAnalysisResult | null> {
    const emotionList = EmotionTypes.join(', ');
    const defaultEmotion = EmotionTypes[EmotionTypes.indexOf('neutral')];
    const system = `Please provide a sentiment of this context. 
Answer using pipe separated format where the first value is a sentiment from the list: ${emotionList} and the second value is the associated probability. 
example:${defaultEmotion}|I am here to help you 
Never generate an answer, by default anser with ${defaultEmotion}|1.0`;

    let content = '';
    try {
      content = await this.llmProvider.chat({
        system,
        message,
        stream: false,
        tag: 'sentiment',
      });
    } catch (e) {
      this.logger.error(`Error calling LLM: ${e.stack}`);
      return null;
    }

    if (content.indexOf('|') === -1) {
      this.logger.warn('Ignored invalid response');
      return null;
    }

    this.logger.verbose(`Result: ${content}`);

    const [value, score] = content.split('|').map((v) => v.trim());

    const emotion = value as Emotion;
    const matches = EmotionTypes.indexOf(emotion) > -1;

    return matches
      ? {
          emotion: {
            value: emotion,
            probability: +score,
          },
        }
      : null;
  }
}
