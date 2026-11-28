import { audioType } from './audio-type.js';

describe('audioType', () => {
  it('tells WAV, Ogg and mp3 apart by their first bytes', () => {
    expect(audioType(Buffer.from('RIFF....WAVEfmt '))).toEqual({
      contentType: 'audio/wav',
      extension: 'wav',
    });
    expect(audioType(Buffer.from('OggS\0'))).toEqual({
      contentType: 'audio/ogg',
      extension: 'ogg',
    });
    expect(audioType(Buffer.from([0xff, 0xf3, 0x44, 0xc4]))).toEqual({
      contentType: 'audio/mpeg',
      extension: 'mp3',
    });
    expect(audioType(Buffer.from('ID3\x04')).extension).toBe('mp3');
    expect(audioType(Buffer.from([])).extension).toBe('mp3');
  });
});
