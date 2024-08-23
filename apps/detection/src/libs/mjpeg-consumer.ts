// typescript port of https://github.com/mmaelzer/mjpeg-consumer/blob/master/lib/mjpeg-consumer.js
import { Transform, TransformCallback } from 'stream';
import { MjpegConsumerOptions, MjpegFrame, MjpegHeaders } from '../buffer.dto';
import { MJPEG_BOUNDARY } from './constants';

// Start of Image
const soi = Buffer.from([0xff, 0xd8]);

// End of Image
const eoi = Buffer.from([0xff, 0xd9]);

export class MjpegConsumer extends Transform {
  private queue: Buffer | null = null;
  private buffer: Buffer | null = null;
  private reading = false;
  private contentLength: number | null = null;
  private bytesWritten = 0;

  private readonly debug: boolean = true;
  private boundary: Buffer;
  private headers: MjpegHeaders | null = null;

  constructor(opts?: MjpegConsumerOptions) {
    super({ ...opts });
    this.boundary = Buffer.from(
      `--${opts && opts.boundary ? opts.boundary : MJPEG_BOUNDARY}`,
    );
    this.debug = opts && opts.debug ? true : false;
  }

  log(msg: string): void {
    if (!this.debug) return;
    this.emit('debug', msg);
    console.log(msg);
  }

  reset(): void {
    this.contentLength = 0;
    this.reading = false;
    this.headers = null;
    this.bytesWritten = 0;
    this.buffer = null;
  }

  /**
   * @param {Number} len - length to initialize buffer
   * @param {Buffer} chunk - chunk of http goodness
   * @param {Number=} start - optional index of start of jpeg chunk
   * @param {Number=} end - optional index of end of jpeg chunk
   *
   * Initialize a new buffer and reset state
   */
  private _initFrame(
    len: number,
    chunk: Buffer,
    start: number,
    end: number,
    headers: MjpegHeaders | null,
  ) {
    this.contentLength = len;
    this.buffer = Buffer.alloc(len);
    this.bytesWritten = 0;
    this.headers = headers;

    const hasStart = start !== undefined && start > -1;
    const hasEnd = end !== undefined && end > -1 && end > start;

    if (!hasStart) return;

    let bufEnd = chunk.length;

    if (hasEnd) {
      bufEnd = end + eoi.length;
    }

    // If we have the eoi bytes, send the frame
    if (hasEnd) {
      this._sendFrame(chunk.subarray(start, bufEnd), headers);
      return;
    }

    // copy the buffer to merge with the next
    this.bytesWritten = chunk.length - start;
    chunk.copy(this.buffer, 0, start, bufEnd);
    this.reading = true;
  }

  /**
   * @param {Buffer} chunk - chunk of http goodness
   * @param {Number} start - index of start of jpeg in chunk
   * @param {Number} end - index of end of jpeg in chunk
   *
   */
  private _readFrame(
    chunk: Buffer,
    start: number,
    end: number,
    headers: MjpegHeaders | null,
  ) {
    const bufStart = start > -1 && start < end ? start : 0;
    const bufEnd = end > -1 ? end + eoi.length : chunk.length;

    if (this.buffer === null) this.buffer = Buffer.from([]);

    chunk.copy(this.buffer, this.bytesWritten, bufStart, bufEnd);
    this.bytesWritten += bufEnd - bufStart;

    // if frame is complete, send it
    if (end > -1 || this.bytesWritten === this.contentLength) {
      this._sendFrame(this.buffer, headers || this.headers);
      return;
    }

    this.reading = true;
  }

  /**
   * Handle sending the frame to the next stream and resetting state
   */
  private _sendFrame(data: Buffer, headers: MjpegHeaders | null): boolean {
    this.reset();
    const frame = data as MjpegFrame;

    frame.headers = headers || ({} as MjpegHeaders);

    const millis = +(
      frame.headers['timestamp'] ||
      frame.headers['ts'] ||
      Date.now()
    );
    frame.headers.timestamp = millis;
    frame.timestamp = millis;

    this.log(`Frame sent ts=${frame.timestamp}`);
    return this.push(frame);
  }

  private _parseHeaders(rawheaders: string): MjpegHeaders {
    const rows = rawheaders.split('\n');
    return rows
      .map((row) => row.match(/^(.+):\s(.+)\r?$/i)) //NOSONAR
      .map((m) => (m ? [m[1], m[2]] : null))
      .filter((m) => m !== null)
      .map((m) => m as string[])
      .reduce(
        (h, [col, val]) => ({ ...h, [col.toLowerCase()]: val }),
        {} as MjpegHeaders,
      );
  }

  _processChunk(buffer: Buffer, encoding: BufferEncoding): void {
    let chunk: Buffer = buffer;
    if (this.queue && this.queue.length) {
      this.log(
        `Merging chunk (${buffer.length}) with queue (${this.queue.length})`,
      );
      chunk = Buffer.alloc(this.queue.length + buffer.length);
      this.queue.copy(chunk);
      buffer.copy(chunk, this.queue.length);
      this.queue = null;
    }

    const boundaryStart = chunk.indexOf(this.boundary);
    let start = chunk.indexOf(soi);
    const end = chunk.indexOf(eoi);

    // do not take the end of a frame and the start of the next
    start = end > -1 && start > end ? -1 : start;

    let len = '';
    let headers: MjpegHeaders | null = null;
    if (start > -1) {
      const headersRaw = chunk.slice(boundaryStart, start).toString('ascii');
      headers = this._parseHeaders(headersRaw);
      len = headers['content-length'] as string;
    }

    this.log(
      `chunk=${chunk.length} buffer=${this.buffer ? true : false} reading=${
        this.reading
      } boundaryStart=${boundaryStart} start=${start} end=${end}`,
    );

    if (this.buffer && (this.reading || start > -1)) {
      this.log(
        `_readFrame contentLength=${this.contentLength} start=${start} end=${end}`,
      );
      this._readFrame(chunk, start, end, headers);
    }

    if (len) {
      this.log(`_initFrame len=${len} start=${start} end=${end}`);
      this._initFrame(+len, chunk, start, end, headers);
    }

    if (!this.reading && end === -1 && start === -1) {
      this.log(`queue orphaned chunk size=${chunk.length}`);
      this.queue = Buffer.alloc(chunk.length);
      chunk.copy(this.queue);
    }

    // if the chunck contains multiple frames, process all of them.
    // the buffer should be empty if the frame has been already sent
    const hasMultipleFrames = end > -1 && chunk.length - (end + eoi.length) > 0;
    if (hasMultipleFrames) {
      this.log(`process multiple frames in chunk from end=${end}`);
      this._processChunk(chunk.subarray(end + eoi.length), encoding);
    }
  }

  _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    done: TransformCallback,
  ): void {
    this._processChunk(chunk, encoding);
    done();
  }
}
