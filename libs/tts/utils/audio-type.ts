/** The media type of an audio buffer, from its first bytes: WAV, Ogg, else mp3. */
export const audioType = (
  audio: Buffer,
): { contentType: string; extension: string } => {
  const magic = audio.subarray(0, 4).toString('latin1');
  if (magic === 'RIFF') return { contentType: 'audio/wav', extension: 'wav' };
  if (magic === 'OggS') return { contentType: 'audio/ogg', extension: 'ogg' };
  return { contentType: 'audio/mpeg', extension: 'mp3' };
};
