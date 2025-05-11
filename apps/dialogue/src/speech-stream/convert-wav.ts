import { Buffer } from 'buffer';

/**
 * Converts raw PCM audio data to WAV format.
 * @param rawAudio - Raw PCM audio as Buffer or Uint8Array.
 * @param sampleRate - Sample rate (e.g., 44100).
 * @param numChannels - Number of audio channels (e.g., 1 for mono, 2 for stereo).
 * @param bitDepth - Bit depth (e.g., 16).
 * @returns Buffer containing WAV-formatted audio data.
 */
export function convertRawPCMToWav(
  rawAudio: Buffer | Uint8Array,
  sampleRate: number = 44100,
  numChannels: number = 1,
  bitDepth: number = 16,
): Buffer {
  const rawData = Buffer.isBuffer(rawAudio) ? rawAudio : Buffer.from(rawAudio);
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const wavHeaderSize = 44;
  const dataSize = rawData.length;
  const totalSize = dataSize + wavHeaderSize - 8;

  const header = Buffer.alloc(wavHeaderSize);

  header.write('RIFF', 0); // ChunkID
  header.writeUInt32LE(totalSize, 4); // ChunkSize
  header.write('WAVE', 8); // Format
  header.write('fmt ', 12); // Subchunk1ID
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(byteRate, 28); // ByteRate
  header.writeUInt16LE(blockAlign, 32); // BlockAlign
  header.writeUInt16LE(bitDepth, 34); // BitsPerSample
  header.write('data', 36); // Subchunk2ID
  header.writeUInt32LE(dataSize, 40); // Subchunk2Size

  return Buffer.concat([header, rawData]);
}
