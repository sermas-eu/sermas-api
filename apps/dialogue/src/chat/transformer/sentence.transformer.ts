import { Logger } from '@nestjs/common';
import { Transform } from 'stream';

export const MIN_SENTENCE_LENGTH = 10;

export class SentenceTransformer extends Transform {
  private buffer: string | undefined;

  private logger = new Logger(SentenceTransformer.name);

  constructor(
    private readonly onInit?: () => void,
    private readonly onComplete?: () => void,
  ) {
    super();
  }

  _transform(
    chunk: Buffer | string,
    encoding: string,
    callback: CallableFunction,
  ) {
    chunk = chunk || '';
    chunk = chunk.toString();

    if (this.buffer === undefined) {
      if (this.onInit) this.onInit();
      this.buffer = '';
    }

    this.buffer += chunk.toString();

    // console.log(`buffer --- ${this.buffer}`);

    if (this.buffer.length >= MIN_SENTENCE_LENGTH) {
      const regex =
        /\b(?:[\w.%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\d{1,2}:\d{2}(?:[ap]m)?|\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?)(?!\S)|[^.?!;:]+[.?!;:]+[\])'"`’”]*|[^.?!;:]+$/gi;

      const matches = [...this.buffer.matchAll(regex)];

      // console.warn(matches);

      let phrase = '';
      let lastIndex = 0;

      for (const match of matches) {
        const fullMatch = match[0];
        const index = match.index ?? 0;

        phrase += fullMatch;

        // console.log(`**** phrase ${phrase}`);

        if (phrase.trim().length >= MIN_SENTENCE_LENGTH) {
          this.sendBuffer(phrase);
          phrase = '';
          lastIndex = index + fullMatch.length;
        }
      }

      // Retain remaining text in the buffer
      this.buffer = this.buffer.slice(lastIndex);
      if (phrase.length > 0) {
        this.buffer = phrase + this.buffer;
      }
    }

    callback();
  }

  sendBuffer(buffer: string) {
    if (!buffer) return;
    const sentence = buffer.replace(/^\n+/gm, '').replace(/\n+$/gm, '');
    this.logger.verbose(`send: ${sentence}`);
    this.push(sentence);
  }

  _flush(callback: CallableFunction) {
    // Flush the remaining incomplete phrase
    if (this.buffer && this.buffer.trim().length > 0) {
      this.sendBuffer(this.buffer);
      this.buffer = '';
    }

    // stream stopped before this transform
    if (this.buffer === undefined) {
      this.logger.verbose(`init`);
      if (this.onInit) this.onInit();
    }

    if (this.onComplete) {
      this.onComplete();
    }
    callback();
    this.logger.verbose(`completed`);
  }
}
