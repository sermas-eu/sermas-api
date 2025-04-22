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
    const end = this.buffer.indexOf(this.closeTag);

    if (start !== -1 && end !== -1 && end > start) {
      const content = this.buffer.slice(start + this.openTag.length, end);
      this.onContent(content.trim());
      this.parsed = true;

      // remove parsed segment, keep the rest
      const before = this.buffer.slice(0, start);
      const after = this.buffer.slice(end + this.closeTag.length);
      this.buffer = (before + after).trimStart();
    } else if (isFlush) {
      // Couldn't find full tag block even after full input
      this.onContent(undefined);
      this.parsed = true;
    }

    // We push remaining buffer only after parsing or on flush
    if (this.parsed && this.buffer.length > 0) {
      this.push(this.buffer);
      this.buffer = '';
    }
  }
}
