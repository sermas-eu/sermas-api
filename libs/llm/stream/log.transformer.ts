import { Logger } from '@nestjs/common';
import { Transform } from 'stream';

export class LogTransformer extends Transform {
  private logger = new Logger('llm.response');
  private buffer: string;

  private started = false;

  constructor(private readonly llmCallId?: string) {
    super({
      objectMode: true,
    });
    this.buffer = '';
    this.on('close', () => {
      this.print('', true);
      this.logger.debug(`RES ${this.llmCallId || ''} ]`);
    });
  }

  print(chunk?: string | Buffer, flush = false) {
    chunk = chunk || '';

    if (chunk) this.buffer += chunk.toString();

    if (!this.buffer) return;
    if (!flush && this.buffer.indexOf('\n') === -1) return;

    if (!this.started) {
      this.logger.debug(`RES ${this.llmCallId || ''} [`);
      this.started = true;
    }

    this.buffer
      .split('\n')
      .forEach((line) =>
        this.logger.debug(`RES ${this.llmCallId || ''} | ${line}`),
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
