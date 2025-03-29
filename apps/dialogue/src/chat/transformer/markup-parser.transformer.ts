import { Transform } from 'stream';

export class StreamingMarkupParserTransformer extends Transform {
  private buffer = '';

  private isTagContent: boolean | undefined = undefined;
  private tagIsClosed = false;
  private tagIsNotFound = false;

  private callbackCalled = false;

  private readonly openTag: string;
  private readonly closeTag: string;

  constructor(
    tag: string,
    private readonly onContent: (raw: string | undefined) => void,
    options?: any,
  ) {
    super({
      ...options,
      objectMode: true,
    });
    this.openTag = `<${tag}>`;
    this.closeTag = `</${tag}>`;
  }

  _transform(
    chunk: Buffer | string,
    encoding: string,
    callback: CallableFunction,
  ) {
    chunk = chunk || '';
    chunk = chunk.toString();

    this.buffer += chunk;

    if (
      this.tagIsNotFound !== true &&
      this.isTagContent !== false &&
      !this.tagIsClosed
    ) {
      const closeTagPos = this.buffer.indexOf(this.closeTag);
      if (this.isTagContent === true && closeTagPos > -1) {
        this.tagIsClosed = true;

        const rawJson = this.buffer.slice(this.openTag.length, closeTagPos);

        this.onContent(rawJson);
        this.callbackCalled = true;

        this.buffer = this.buffer.slice(
          closeTagPos + this.closeTag.length, //+1 is carriage return
        );
        if (this.buffer.startsWith('\n')) {
          this.buffer = this.buffer.slice(1);
        }
      } else {
        // wait for buffer length, then check for tag
        if (
          this.isTagContent === undefined &&
          this.buffer.length >= this.openTag.length
        ) {
          const isToolAnswer = this.buffer.startsWith(this.openTag);
          this.isTagContent = isToolAnswer;
        }
      }
    }

    this.sendBuffer();

    callback();
  }

  sendBuffer() {
    // tag not found at this point
    if (
      this.buffer.length > this.openTag.length &&
      this.isTagContent === false
    ) {
      this.tagIsNotFound = true;
    }

    if (
      this.tagIsNotFound === true ||
      this.isTagContent === false ||
      this.tagIsClosed === true
    ) {
      this.push(this.buffer);
      this.buffer = '';
    }
  }

  _flush(callback: CallableFunction) {
    // Flush the remaining incomplete phrase
    if (this.buffer.trim().length > 0) {
      this.sendBuffer();
    }
    if (!this.callbackCalled) {
      this.onContent && this.onContent(undefined);
    }
    callback();
  }
}
