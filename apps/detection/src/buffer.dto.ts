import { TransformOptions } from 'stream';

export interface MjpegFrame extends Buffer {
  headers?: MjpegHeaders;
  timestamp: number;
}

export interface MjpegHeaders extends Record<string, string | number> {
  timestamp: number;
  microseconds: number;
  seconds: number;
}

export interface MjpegConsumerOptions extends TransformOptions {
  boundary?: string;
  debug?: boolean;
}
