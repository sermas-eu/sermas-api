import { VideoFrame } from '../detection.streamer.dto.js';
import { CRLF, MJPEG_BOUNDARY } from './constants.js';

export const toMjpegBuffer = (frame: VideoFrame): Buffer => {
  const headers = [
    `--${MJPEG_BOUNDARY}`,
    ...Object.keys(frame?.headers || {}).map(
      (header) => `${header}: ${frame.headers[header]}`,
    ),
    CRLF,
  ];
  return Buffer.concat([Buffer.from(headers.join(CRLF)), frame]);
};
