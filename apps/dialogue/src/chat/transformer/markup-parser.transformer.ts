import { Transform } from 'stream';

export class StreamingMarkupParserTransformer extends Transform {
  private buffer = '';
  private parsed = false;

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
    this.tryParse(true); // final attempt to parse
    if (!this.parsed) {
      this.onContent(undefined);
    }

    if (this.buffer.length > 0) {
      this.push(this.buffer); // push leftovers
    }

    callback();
  }

  private tryParse(isFlush = false) {
    if (this.parsed) return;

    const start = this.buffer.indexOf(this.openTag);
    const end = this.buffer.indexOf(this.closeTag, start);

    // Case: <tag> not found at all yet
    if (start === -1) {
      // Push early content downstream and retain only last few chars (in case <tag> spans chunks)
      if (!isFlush) {
        const keep = this.buffer.slice(-this.openTag.length); // retain possible partial openTag
        const toPush = this.buffer.slice(0, -this.openTag.length);
        if (toPush.length > 0) this.push(toPush);
        this.buffer = keep;
      } else {
        // Flush: no tag found
        this.onContent(undefined);
        this.push(this.buffer);
        this.buffer = '';
        this.parsed = true;
      }
      return;
    }

    // Case: found complete <tag>...</tag>
    if (start !== -1 && end !== -1 && end > start) {
      const content = this.buffer.slice(start + this.openTag.length, end);
      this.onContent(content.trim());
      this.parsed = true;

      // Push everything before and after the tag
      const before = this.buffer.slice(0, start);
      const after = this.buffer.slice(end + this.closeTag.length);
      if (before.length > 0) this.push(before);
      if (after.length > 0) this.push(after);
      this.buffer = '';
    } else if (isFlush) {
      // Flush: incomplete tag
      this.onContent(undefined);
      this.push(this.buffer);
      this.buffer = '';
      this.parsed = true;
    }
  }
}
