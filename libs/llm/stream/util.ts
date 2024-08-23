import { Readable } from 'stream';

export const readResponse = (stream: Readable) => {
  return new Promise<string>((resolve, reject) => {
    let buffer = '';
    stream
      .on('data', (data) => {
        buffer += data.toString();
      })
      .on('end', () => {
        resolve(buffer);
      })
      .on('error', (e) => reject(e));
  });
};
