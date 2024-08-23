import { Logger } from '@nestjs/common';
import { Transform, TransformCallback } from 'stream';

export class TudaLLama2ChatMessageStream extends Transform {
  protected logger = new Logger(TudaLLama2ChatMessageStream.name);

  protected fulltext: string = '';
  protected chunks: string[] = [];
  protected buffer = '';

  private foundResponse = false;
  private responseEnded = false;

  constructor(options?: any) {
    super({
      ...(options || {}),
      objectMode: true,
    });
  }

  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    chunk = chunk || '';

    if (chunk.toString) {
      chunk = chunk.toString();
    }

    if (this.responseEnded) return;

    this.fulltext += chunk;
    this.buffer += chunk;

    const systemTag = '<system>';
    const systemTagIndex = this.buffer.indexOf(systemTag);

    // console.log('textResponse', this.textResponse);

    if (!this.foundResponse && systemTagIndex > -1) {
      // matched the response parts

      this.logger.debug('found starting tag <system>');
      this.foundResponse = true;

      let response = this.buffer.substring(0, systemTagIndex);

      if (response.indexOf('<slots>') > -1) {
        const parts = response.split('<slots>');
        const intent = parts.shift().replace(/\n/, ' ');
        response = parts.join('');
        this.logger.debug(`intent=${intent}`);
      }

      if (response.indexOf('<slots>') > -1) {
        const parts = response.split('<slots>');
        const slots = parts.shift().replace(/\n/, ' ');
        response = parts.join('');
        this.logger.debug(`slots=${slots}`);
      }

      this.buffer = this.buffer.substring(systemTagIndex + systemTag.length);
      if (this.buffer.startsWith(':')) {
        this.buffer = this.buffer.substring(1);
      }
    }

    if (this.foundResponse && !this.responseEnded) {
      const matches = this.buffer.match(/(<[^<]+>)/);

      if (matches && matches?.index !== undefined) {
        this.responseEnded = true;
        this.buffer = this.buffer.substring(0, matches?.index);

        if (!this.buffer.trim().length) {
          this.logger.warn(`Content not found`);
        } else {
          this.push(this.buffer);
        }

        this.logger.debug(`RAW [`);
        this.fulltext.split('\n').map((t) => this.logger.debug(`RAW | ${t}`));
        this.logger.debug(`RAW ]`);

        this.logger.debug(`Closing stream`);
        this.end();
      }
    }

    callback();
  }
}
