import { Mp3Encoder } from '@breezystack/lamejs';
import wavefile from 'wavefile';

// samples per MPEG-1 Layer III frame
const FRAME = 1152;

/**
 * Encode a PCM WAV buffer as mono mp3. Any bit depth and channel count is accepted:
 * the samples are converted to 16 bit and, for more than one channel, the first one
 * is used.
 */
export const wavToMp3 = (wav: Buffer, kbps = 64): Buffer => {
  const wave = new wavefile.WaveFile(wav);
  wave.toBitDepth('16');

  const fmt = wave.fmt as { sampleRate: number; numChannels: number };
  let samples = wave.getSamples(false, Int16Array) as unknown as
    Int16Array | Int16Array[];
  if (Array.isArray(samples)) samples = samples[0];

  const encoder = new Mp3Encoder(1, fmt.sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += FRAME) {
    const out = encoder.encodeBuffer(samples.subarray(i, i + FRAME));
    if (out.length) chunks.push(out);
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(tail);

  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
};
