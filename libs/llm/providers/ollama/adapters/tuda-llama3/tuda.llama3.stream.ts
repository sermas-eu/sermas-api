import { Logger } from '@nestjs/common';
import { appendFileSync } from 'fs';
import { Transform, TransformCallback } from 'stream';

export class TudaLLama3ChatMessageStream extends Transform {
  protected logger = new Logger(TudaLLama3ChatMessageStream.name);

  protected fulltext: string = '';
  protected chunks: string[] = [];
  protected buffer = '';

  private foundResponse = false;
  private skip = false;

  private foundAttributes = false;
  private foundIntention = false;

  constructor(options?: any) {
    super({
      ...(options || {}),
      objectMode: true,
    });
  }

  end(...args): this {
    this.logger.debug(`RAW [`);
    this.fulltext.split('\n').map((t) => this.logger.debug(`RAW | ${t}`));
    this.logger.debug(`RAW ]`);

    if (process.env.LOG_LLAMA3 === '1') {
      appendFileSync('./tmp/llama.log', `\n---\nRESPONSE\n${this.fulltext}`);
    }

    this.logger.debug(`Closing stream`);
    super.end(...args);
    return this;
  }

  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    chunk = chunk || '';

    /*
User Intention:
    Parcel Choice
Attributes:
    Weight: 10kg
    Destination: London, UK
Virtual Agent:
    If your item weighs only 10kg, I recommend to use our medium-sized box.
    */

    const labels = {
      intention: 'User Intention:',
      attributes: 'Attributes:',
      agentResponse: 'Virtual Agent:',
      customer: 'Customer:',
    };

    this.buffer = chunk.toString ? chunk.toString() : chunk;
    this.fulltext += this.buffer;

    const agentPos = this.fulltext.indexOf(labels.agentResponse);

    const attrPos = this.fulltext.indexOf(labels.attributes);
    if (!this.foundAttributes && attrPos > -1 && agentPos > -1) {
      const attributes = this.fulltext.substring(
        attrPos + labels.attributes.length,
        agentPos,
      );
      this.logger.warn(`attributes: ${attributes}`);
      this.foundAttributes = true;
    }

    const intentionPos = this.fulltext.indexOf(labels.intention);
    if (!this.foundIntention && intentionPos > -1 && attrPos > -1) {
      const intent = this.fulltext.substring(
        intentionPos + labels.intention.length - 1,
        attrPos,
      );
      this.logger.warn(`intent: ${intent}`);
      this.foundIntention = true;
    }

    // got agent answer
    if (this.foundResponse) {
      if (!this.skip) {
        let text = this.buffer.replace(/^\s+|\s+$/g, ' ');
        this.buffer = '';

        const markers = ['\n', '###', '(document', 'USER', 'The user is '];

        // take the first matching
        const matches: number[] = [];
        for (const marker of markers) {
          const pos = text.indexOf(marker);
          if (pos > -1) {
            matches.push(pos);
          }
        }

        const breakPos = matches.length ? matches.sort()[0] : -1;

        if (breakPos > -1) {
          text = text.substring(0, breakPos).trim();
        }
        if (text) this.push(text);

        if (breakPos > -1) {
          this.skip = true;
          this.end();
        }
      }

      callback();
      return;
    }

    const pos = this.fulltext.indexOf(labels.agentResponse);
    if (pos > -1) {
      this.foundResponse = true;
      this.buffer = this.buffer.substring(
        0,
        pos + labels.agentResponse.length - 1,
      );
    }

    callback();
  }
}
