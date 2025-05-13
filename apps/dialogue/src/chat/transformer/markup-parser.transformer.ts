import { Transform } from 'stream';

export class StreamingMarkupParserTransformer extends Transform {
  private buffer = '';
  private hasEmitted = false; // replaces `parsed` to track onContent call during flush

  private readonly openTag: string;
  private readonly closeTag: string;

  constructor(
    tag: string,
    private readonly onContent: (raw: string | undefined) => void,
    options?: any,
  ) {
    super({ ...options, objectMode: true });

    this.openTag = `<${tag}>`;
    this.closeTag = `</${tag}>`;
  }

  _transform(
    chunk: Buffer | string,
    _encoding: string,
    callback: CallableFunction,
  ) {
    this.buffer += (chunk || '').toString();
    this.tryParse();
    callback();
  }

  _flush(callback: CallableFunction) {
    this.tryParse(true);
    if (!this.hasEmitted) {
      this.onContent(undefined);
    }

    if (this.buffer.length > 0) {
      this.push(this.buffer);
    }

    callback();
  }

  private tryParse(isFlush = false) {
    const jsonBlockMatch = this.buffer.match(/^\s*```json\s*\r?\n/);
    if (jsonBlockMatch) {
      this.buffer = this.buffer.slice(jsonBlockMatch[0].length);
    }

    while (true) {
      const start = this.buffer.indexOf(this.openTag);
      if (start === -1) {
        // No tag start found
        if (!isFlush) {
          // Push everything *except* last few characters that might be part of a start tag
          const minTagLength = this.openTag.length;
          const safe = this.buffer.slice(0, -minTagLength);
          const remain = this.buffer.slice(-minTagLength);
          if (safe.length > 0) this.push(safe);
          this.buffer = remain;
        } else {
          if (this.buffer.length > 0) {
            this.push(this.buffer);
          }
          this.buffer = '';
        }
        return;
      }

      const end = this.buffer.indexOf(this.closeTag, start);
      if (end === -1) {
        // Incomplete tag — wait for more data
        if (isFlush) {
          this.onContent(undefined);
          this.hasEmitted = true;
          this.push(this.buffer);
          this.buffer = '';
        }
        return;
      }

      const content = this.buffer.slice(start + this.openTag.length, end);
      this.onContent(content.trim());
      this.hasEmitted = true;

      const before = this.buffer.slice(0, start);
      if (before.length > 0) this.push(before);

      this.buffer = this.buffer.slice(end + this.closeTag.length);
    }
  }
}
