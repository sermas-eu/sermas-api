import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fuzzy from 'fast-fuzzy';

@Injectable()
export class WakeWordService {
  private readonly logger = new Logger(WakeWordService.name);

  private wakeWords: string[];

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get('WAKE_WORDS');

    this.wakeWords = raw
      .split(',')
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
      .map((w: string) => w.toLowerCase());
  }

  setWakeWords(words: string[]) {
    this.wakeWords = words;
  }

  async match(text: string): Promise<string | null> {
    if (!text) return null;

    let res = fuzzy.search(text, this.wakeWords, {
      ignoreCase: true,
      ignoreSymbols: true,
      normalizeWhitespace: true,
      // returnMatchData: true,
      threshold: 0.6,
    });

    if (!res.length) {
      res = this.wakeWords
        .filter((w) =>
          text.toLowerCase().match(new RegExp(`\s?${w}\s?`, 'im')) ? w : null,
        )
        .filter((w) => w !== null);
    }

    return res.length > 0 ? res[0] : null;
  }
}
