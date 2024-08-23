import { Readable } from 'stream';
import * as sox from 'sox-stream';
import * as wavefile from 'wavefile';

const soxConvert = (
  input: Buffer,
  options: sox.SoxOptions,
): Promise<Buffer> => {
  try {
    const stream = Readable.from(input).pipe(sox(options));
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (data: Buffer) => {
        chunks.push(data);
      });
      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      stream.on('error', (err: Error) => {
        reject(err);
      });
    });
  } catch (e) {
    return Promise.reject(e);
  }
};

export const convertRawToWav = (
  input: Buffer,
  sampleRate = 8192,
  bitDepth = 16,
  channels = 1,
  encoding: sox.Encoding = 'signed-integer',
  outSampleRate = 8192,
): Promise<Buffer> => {
  return soxConvert(input, {
    input: {
      e: encoding,
      r: sampleRate,
      c: channels,
      b: bitDepth,
      v: 0.8,
      type: 'raw',
    },
    output: {
      rate: outSampleRate,
      channels: 1,
      bits: 16,
      type: 'wav',
    },
  });
};

export const convertWav = (
  input: Buffer,
  sampleRate = 16000,
  bitDepth = '16',
): Promise<Buffer> => {
  const wave = new wavefile.WaveFile(input);
  wave.toSampleRate(sampleRate);
  wave.toBitDepth(bitDepth);
  return Promise.resolve(Buffer.from(wave.toBuffer()));
};
