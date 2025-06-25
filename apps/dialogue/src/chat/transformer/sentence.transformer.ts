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
      const { text: protectedText, placeholders } = this.protectTokens(
        this.buffer,
      );

      const sentenceSplitRegex = /[^.?!;]+[.?!;]+[\])'"`’”]*|[^.?!;]+$/g;
      const matches = protectedText.matchAll(sentenceSplitRegex);

      let phrase = '';
      let lastIndexInProtected = 0;

      for (const match of matches) {
        const matchText = match[0];
        phrase += matchText;

        if (
          phrase.trim().length >= MIN_SENTENCE_LENGTH &&
          /[.?!;][\])'"`’”]*\s*$/.test(matchText)
        ) {
          const restored = this.restoreTokens(phrase, placeholders);
          this.sendBuffer(restored);
          lastIndexInProtected = match.index! + matchText.length;
          phrase = '';
        }
      }

      // Now compute the correct slice index in the original string
      const processedProtected = protectedText.slice(0, lastIndexInProtected);
      const restoredUpToLastIndex = this.restoreTokens(
        processedProtected,
        placeholders,
      );

      // Slice the original buffer using the length of the restored segment
      this.buffer = this.buffer.slice(restoredUpToLastIndex.length);
    }

    callback();
  }
  private getOriginalIndex(
    original: string,
    protectedText: string,
    protectedIndex: number,
  ): number {
    // Find the protected substring up to protectedIndex
    const protectedPrefix = protectedText.slice(0, protectedIndex);

    // Re-encode the original with the same protectTokens() logic,
    // but only return the length of the original substring that
    // corresponds to the protectedPrefix
    const { text: newProtectedText } = this.protectTokens(original);

    let i = 0;
    while (
      i < original.length &&
      newProtectedText.slice(0, i) !== protectedPrefix
    ) {
      i++;
    }

    return i;
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
