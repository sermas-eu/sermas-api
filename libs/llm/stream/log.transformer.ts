import { Logger } from '@nestjs/common';
import { Transform } from 'stream';

export class LogTransformer extends Transform {
  private logger = new Logger('llm.response');
  private buffer: string;

  constructor() {
    super({
      objectMode: true,
    });
    this.buffer = '';
    this.on('close', () => {
      this.print();
    });
  }

  print(chunk?: string | Buffer) {
    chunk = chunk || '';

    if (chunk) this.buffer += chunk.toString();

    if (!this.buffer || this.buffer.length) return;
    if (this.buffer.indexOf('\n') === -1) return;

    this.buffer.split('\n').forEach((line) => this.logger.debug(`| ${line}`));
    this.buffer = '';
  }

  _transform(
    chunk: Buffer | string,
    encoding: string,
    callback: CallableFunction,
  ) {
    this.print(chunk);
    this.push(chunk);
    callback();
  }
}
