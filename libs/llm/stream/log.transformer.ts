import { Transform } from 'stream';

export class LogTransformer extends Transform {
  private buffer: string;

  constructor(private readonly onClose?: (buffer: string) => void) {
    super({
      objectMode: true,
    });
    this.buffer = '';
    this.on('close', () => {
      if (this.onClose) this.onClose(this.buffer);
    });
  }
  _transform(
    chunk: Buffer | string,
    encoding: string,
    callback: CallableFunction,
  ) {
    if (chunk) this.buffer += chunk.toString();
    this.push(chunk);
    callback();
  }
}
