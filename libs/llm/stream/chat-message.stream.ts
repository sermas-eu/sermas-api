import { Readable } from 'stream';

export class ChatMessageStream extends Readable {
  protected chunks: string[] = [];

  constructor(options?: any) {
    super({
      ...(options || {}),
      objectMode: true,
    });
  }

  close() {
    this.add(null);
  }

  add(chunk: string) {
    this.chunks.push(chunk);
    if (!this.isPaused()) {
      this.pushChunk();
    }
  }

  protected pushChunk() {
    if (this.chunks.length > 0) {
      const chunk = this.chunks.shift();
      if (!this.push(chunk)) {
        // If push returns false, it means the internal buffer is full.
        // We should pause the stream and wait for the 'drain' event to resume.
        // this.pause();
      }
    }
  }

  _read() {
    this.pushChunk();
  }
}
