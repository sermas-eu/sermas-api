import { Transform } from 'stream';

export const MIN_SENTENCE_LENGTH = 15;

export class SentenceTransformer extends Transform {
  private buffer: string | undefined;

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

    if (this.buffer.length >= MIN_SENTENCE_LENGTH) {
      // const regex = /[^\d|.| ][.?!][^a-z]?[\s|\n]?/i;
      const regex = /[^.?!]+[.!?]+[\])'"`’”]*|.+/gi;
      let match = this.buffer.match(regex);
      let phrase = '';
      while (match && match?.index !== undefined) {
        phrase += this.buffer.substring(0, match?.index + 3);
        // ensure min length is reached
        if (phrase.trim().length >= MIN_SENTENCE_LENGTH) {
          // console.warn(`-----------> ${phrase}`);
          this.sendBuffer(phrase);
          phrase = '';
        }

        this.buffer = this.buffer.substring(match?.index + 3);
        match = this.buffer.match(regex);
      }

      // add back to buffer if left over
      if (phrase.length > 0) {
        this.buffer = phrase + this.buffer;
      }
    }

    callback();
  }

  sendBuffer(buffer: string) {
    if (!buffer) return;
    this.push(buffer.replace(/^\n+/gm, '').replace(/\n+$/gm, ''));
  }

  _flush(callback: CallableFunction) {
    // Flush the remaining incomplete phrase
    if (this.buffer && this.buffer.trim().length > 0) {
      this.sendBuffer(this.buffer);
      this.buffer = '';
    }

    // stream stopped before this transform
    if (this.buffer === undefined) {
      if (this.onInit) this.onInit();
    }

    if (this.onComplete) this.onComplete();
    callback();
  }
}
