export type WavStats = {
  durationMs: number;
  /** RMS level in dBFS (0 is full scale, silence tends to -Infinity) */
  rmsDbfs: number;
};

/**
 * Duration and RMS level of a 16-bit PCM WAV buffer. Undefined for anything else
 * (another encoding, a malformed header), so callers skip their check rather than
 * drop audio they cannot judge.
 */
export const wavStats = (buffer?: Buffer): WavStats | undefined => {
  if (!buffer || buffer.length < 44) return undefined;
  if (
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    return undefined;
  }

  let offset = 12;
  let format: number | undefined;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let data: Buffer | undefined;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ' && start + 16 <= buffer.length) {
      format = buffer.readUInt16LE(start);
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      bitsPerSample = buffer.readUInt16LE(start + 14);
    } else if (id === 'data') {
      // streamed WAVs may declare a size larger than what was written
      data = buffer.subarray(start, Math.min(start + size, buffer.length));
      break;
    }
    offset = start + size + (size % 2);
  }

  // PCM (1) or WAVE_FORMAT_EXTENSIBLE (0xfffe) with 16-bit samples only
  if (
    !data ||
    (format !== 1 && format !== 0xfffe) ||
    bitsPerSample !== 16 ||
    !channels ||
    !sampleRate
  ) {
    return undefined;
  }

  const samples = Math.floor(data.length / 2);
  if (!samples) return { durationMs: 0, rmsDbfs: -Infinity };

  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const s = data.readInt16LE(i * 2) / 32768;
    sum += s * s;
  }
  const rms = Math.sqrt(sum / samples);
  return {
    durationMs: (samples / channels / sampleRate) * 1000,
    rmsDbfs: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
  };
};
