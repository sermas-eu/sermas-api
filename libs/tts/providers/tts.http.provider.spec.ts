import type { Mocked } from 'vitest';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import wavefile from 'wavefile';
import { HttpTextToSpeech, supportedLanguage } from './tts.http.provider.js';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

/** A mono PCM16 WAV with a 440 Hz tone. */
const toneWav = (seconds = 0.5, sampleRate = 24000, channels = 1): Buffer => {
  const n = Math.round(seconds * sampleRate);
  const ch = Array.from({ length: channels }, () =>
    Int16Array.from({ length: n }, (_, i) =>
      Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / sampleRate)),
    ),
  );
  const wave = new wavefile.WaveFile();
  wave.fromScratch(channels, sampleRate, '16', channels === 1 ? ch[0] : ch);
  return Buffer.from(wave.toBuffer());
};

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('supportedLanguage', () => {
  it('takes the language part of the code, case-insensitively', () => {
    expect(supportedLanguage('it-IT', 'it,en')).toBe('it');
    expect(supportedLanguage('EN-gb', ' it , en ')).toBe('en');
  });

  it('refuses a language outside the list, or none', () => {
    expect(supportedLanguage('de-DE', 'it,en')).toBeUndefined();
    expect(supportedLanguage(undefined, 'it,en')).toBeUndefined();
  });
});

describe('HttpTextToSpeech', () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.post.mockResolvedValue({ data: toneWav() });
  });

  it('posts text, language and voice and returns the WAV unchanged', async () => {
    const tts = new HttpTextToSpeech(
      config({
        TTS_HTTP_URL: 'http://speech.example.org:8444/',
        TTS_HTTP_VOICES: 'it-M=im_nicola',
      }),
    );
    const out = await tts.speak({
      text: 'Ciao',
      languageCode: 'it-IT',
      gender: 'M',
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://speech.example.org:8444/v1/synthesize',
      { text: 'Ciao', language: 'it', voice: 'im_nicola' },
      { responseType: 'arraybuffer' },
    );
    expect(out.equals(toneWav())).toBe(true);
  });

  it('sends a null voice when none is configured, and the avatar model when set', async () => {
    const tts = new HttpTextToSpeech(
      config({ TTS_HTTP_URL: 'http://speech.example.org' }),
    );
    await tts.speak({ text: 'Hi', languageCode: 'en-GB' });
    expect(mockedAxios.post.mock.calls[0][1]).toMatchObject({ voice: null });

    await tts.speak({ text: 'Hi', languageCode: 'en-GB', model: 'am_adam' });
    expect(mockedAxios.post.mock.calls[1][1]).toMatchObject({
      voice: 'am_adam',
    });
  });

  it('fails on an unsupported language without calling the service', async () => {
    const tts = new HttpTextToSpeech(
      config({ TTS_HTTP_URL: 'http://speech.example.org' }),
    );
    await expect(
      tts.speak({ text: 'Hallo', languageCode: 'de-DE' }),
    ).rejects.toThrow(/does not support language=de-DE/);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('fails without TTS_HTTP_URL', async () => {
    const tts = new HttpTextToSpeech(config({}));
    await expect(
      tts.speak({ text: 'Ciao', languageCode: 'it-IT' }),
    ).rejects.toThrow(/TTS_HTTP_URL/);
  });

  it('returns nothing for no text', async () => {
    const tts = new HttpTextToSpeech(config({ TTS_HTTP_URL: 'http://x' }));
    expect((await tts.speak({ languageCode: 'it-IT' })).length).toBe(0);
  });
});
