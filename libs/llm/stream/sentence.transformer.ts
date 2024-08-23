import { Transform } from 'stream';
import {
  AnswerResponse,
  ToolResponse,
  ToolWithAnswerResponse,
} from '../tools/tool.dto';

export const MIN_SENTENCE_LENGTH = 10;

export class SentenceTransformer extends Transform {
  private buffer = '';
  private isToolAnswer = false;

  constructor(options?: any) {
    super({
      ...options,
      objectMode: true,
    });
  }

  _transform(
    chunk: Buffer | string | AnswerResponse | ToolResponse,
    encoding: string,
    callback: CallableFunction,
  ) {
    chunk = chunk || '';

    const isBuffer = (chunk as Buffer).byteLength !== undefined;
    if (isBuffer) {
      chunk = chunk.toString();
    }

    if (typeof chunk === 'string') {
      this.buffer += chunk.toString();
    } else {
      const data = chunk as ToolWithAnswerResponse;

      this.isToolAnswer = data.type !== undefined;

      if (data.type === 'tools') {
        this.push(data);
        callback();
        return;
      }
      // answer type
      this.buffer += data.data.toString();
    }

    // console.warn('XXXXXX -----', chunk.toString());

    const regex = /[^\d|.| ][.?!][\s|\n]?/i;
    let match = this.buffer.match(regex);
    let phrase = '';
    while (match && match?.index !== undefined) {
      phrase += this.buffer.substring(0, match?.index + 3);
      // ensure min length is reached
      if (phrase.trim().length >= MIN_SENTENCE_LENGTH) {
        // console.warn(`-----------> ${phrase}`);
        this.sendBuffer(phrase);
        phrase = '';
      }

      this.buffer = this.buffer.substring(match?.index + 3);
      match = this.buffer.match(regex);
    }

    // add back to buffer if left over
    if (phrase.length > 0) {
      this.buffer = phrase + this.buffer;
    }

    callback();
  }

  sendBuffer(buffer: string) {
    if (this.isToolAnswer) {
      const res: AnswerResponse = {
        type: 'answer',
        data: buffer,
      };
      this.push(res);
    } else {
      // plain text
      this.push(buffer);
    }
  }

  _flush(callback: CallableFunction) {
    // Flush the remaining incomplete phrase
    if (this.buffer.trim().length > 0) {
      this.sendBuffer(this.buffer);
      this.buffer = '';
    }
    callback();
  }
}
