import { Logger } from '@nestjs/common';
import { Transform, TransformCallback } from 'stream';

export const MIN_SENTENCE_LENGTH = 10;

type PlaceholderMap = { [key: string]: string };

export class SentenceTransformer extends Transform {
  private buffer: string | undefined;
  private logger = new Logger(SentenceTransformer.name);
  private idCounter = 0;

  constructor(
    private readonly onInit?: () => void,
    private readonly onComplete?: () => void,
  ) {
    super();
  }

  _transform(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    const data = chunk?.toString?.() || '';

    if (this.buffer === undefined) {
      this.logger.verbose('init');
      if (this.onInit) this.onInit();
      this.buffer = '';
    }

    this.buffer += data;

    if (this.buffer.length >= MIN_SENTENCE_LENGTH) {
      const { text, placeholders } = this.protectTokens(this.buffer);

      const sentenceSplitRegex = /[^.?!;:]+[.?!;:]+[\])'"`’”]*|[^.?!;:]+$/g;
      const matches = text.match(sentenceSplitRegex) || [];

      let phrase = '';
      let lastIndex = 0;

      for (const match of matches) {
        phrase += match;

        if (
          phrase.trim().length >= MIN_SENTENCE_LENGTH &&
          /[.?!;:][\])'"`’”]*\s*$/.test(match)
        ) {
          const restored = this.restoreTokens(phrase, placeholders);
          this.sendBuffer(restored);
          phrase = '';
          lastIndex += match.length;
        }
      }

      this.buffer = this.restoreTokens(text.slice(lastIndex), placeholders);
    }

    callback();
  }

  sendBuffer(buffer: string) {
    const sentence = buffer.trim();
    if (!sentence) return;

    const cleaned = sentence.replace(/^\n+|\n+$/g, '');
    this.logger.verbose(`send: ${cleaned}`);
    this.push(cleaned);
  }

  _flush(callback: TransformCallback) {
    if (this.buffer && this.buffer.trim().length > 0) {
      this.sendBuffer(this.buffer);
      this.buffer = '';
    }

    if (this.buffer === undefined) {
      this.logger.verbose(`init`);
      if (this.onInit) this.onInit();
    }

    if (this.onComplete) {
      this.onComplete();
    }

    this.logger.verbose(`completed`);
    callback();
  }

  private protectTokens(text: string): {
    text: string;
    placeholders: PlaceholderMap;
  } {
    const patterns = [
      /[\w.%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // emails
      /\b\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?\b/g, // numbers with . or ,
      /\b\d{1,2}:\d{2}(?:[ap]m)?\b/gi, // time
    ];

    const placeholders: PlaceholderMap = {};

    for (const pattern of patterns) {
      text = text.replace(pattern, (match) => {
        const token = `{{__P${this.idCounter++}__}}`;
        placeholders[token] = match;
        return token;
      });
    }

    return { text, placeholders };
  }

  private restoreTokens(text: string, placeholders: PlaceholderMap): string {
    for (const [token, original] of Object.entries(placeholders)) {
      const tokenRegex = new RegExp(
        token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g',
      );
      text = text.replace(tokenRegex, original);
    }
    return text;
  }
}
