import { Logger } from '@nestjs/common';
import { Transform } from 'stream';

export class LogTransformer extends Transform {
  private buffer: string;

  private started = false;

  constructor(
    private readonly logger: Logger,
    private readonly llmCallId?: string,
  ) {
    super({
      objectMode: true,
    });
    this.buffer = '';
    this.on('close', () => {
      this.print('', true);
      this.logger.debug(`${this.llmCallId || ''} |---`);
    });
  }

  print(chunk?: string | Buffer, flush = false) {
    chunk = chunk || '';

    if (chunk) this.buffer += chunk.toString();

    if (!this.buffer) return;
    if (!flush && this.buffer.indexOf('\n') === -1) return;

    if (!this.started) {
      this.logger.debug(`${this.llmCallId || ''} |---`);
      this.started = true;
    }

    this.buffer
      .split('\n')
      .forEach((line) =>
        this.logger.debug(`${this.llmCallId || ''} | ${line}`),
      );
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
