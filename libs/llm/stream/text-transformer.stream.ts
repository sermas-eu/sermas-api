import { Transform, TransformCallback } from 'stream';

// transform chunks to string
export class TextTransformer extends Transform {
  constructor() {
    super({
      objectMode: true,
    });
  }

  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.push((chunk || '').toString());
    callback();
  }
}
