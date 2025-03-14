import { Transform } from 'stream';

export const TOOLS_OPEN_TAG = '<tools>';
export const TOOLS_CLOSE_TAG = '</tools>';

export class StreamingToolsTransformer extends Transform {
  private buffer = '';

  private isToolAnswer: boolean | undefined = undefined;
  private toolsClosed = false;

  constructor(
    private readonly rawToolsCallback: (rawJson: string) => void,
    options?: any,
  ) {
    super({
      ...options,
      objectMode: true,
    });
  }

  _transform(
    chunk: Buffer | string,
    encoding: string,
    callback: CallableFunction,
  ) {
    chunk = chunk || '';
    chunk = chunk.toString();

    this.buffer += chunk;

    if (this.isToolAnswer !== false && !this.toolsClosed) {
      const closeTagPos = this.buffer.indexOf(TOOLS_CLOSE_TAG);
      if (this.isToolAnswer === true && closeTagPos > -1) {
        this.toolsClosed = true;

        const rawJson = this.buffer.slice(TOOLS_OPEN_TAG.length, closeTagPos);
        this.rawToolsCallback(rawJson);

        this.buffer = this.buffer.slice(closeTagPos + TOOLS_CLOSE_TAG.length);
      } else {
        // wait for buffer length, then check for tag
        if (
          this.isToolAnswer === undefined &&
          this.buffer.length >= TOOLS_OPEN_TAG.length
        ) {
          const isToolAnswer = this.buffer.startsWith(TOOLS_OPEN_TAG);
          this.isToolAnswer = isToolAnswer;
        }
      }
    }

    this.sendBuffer();

    callback();
  }

  sendBuffer() {
    if (this.isToolAnswer === false || this.toolsClosed === true) {
      this.push(this.buffer);
      this.buffer = '';
    }
  }

  _flush(callback: CallableFunction) {
    // Flush the remaining incomplete phrase
    if (this.buffer.trim().length > 0) {
      this.sendBuffer();
    }
    callback();
  }
}
