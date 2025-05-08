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
    this.buffer += chunk.toString();
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
    const start = this.buffer.indexOf(this.openTag);
    const end = this.buffer.indexOf(this.closeTag, start);

    if (start === -1) {
      // Keep trailing potential open tag
      if (!isFlush) {
        const keep = this.buffer.slice(-this.openTag.length);
        const toPush = this.buffer.slice(0, -this.openTag.length);
        if (toPush.length > 0) this.push(toPush);
        this.buffer = keep;
      } else {
        // No tag found, flush remaining
        this.onContent(undefined);
        this.hasEmitted = true;
        this.push(this.buffer);
        this.buffer = '';
      }
      return;
    }

    if (end === -1) {
      // <tag> found but </tag> not yet — wait for more chunks
      if (isFlush) {
        this.onContent(undefined);
        this.hasEmitted = true;
        this.push(this.buffer);
        this.buffer = '';
      }
      return;
    }

    // Full tag found
    const content = this.buffer.slice(start + this.openTag.length, end);
    this.onContent(content.trim());
    this.hasEmitted = true;

    const before = this.buffer.slice(0, start);
    const after = this.buffer.slice(end + this.closeTag.length);
    if (before.length > 0) this.push(before);
    if (after.length > 0) this.push(after);
    this.buffer = '';
  }
}
