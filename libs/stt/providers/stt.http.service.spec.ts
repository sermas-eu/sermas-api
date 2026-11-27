import type { Mocked } from 'vitest';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { HttpSpeechToText } from './stt.http.service.js';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const formText = (form: FormData) => form.getBuffer().toString('latin1');

describe('HttpSpeechToText', () => {
  beforeEach(() => {
    mockedAxios.postForm.mockReset();
  });

  it('posts the audio and the two-letter language and reads text', async () => {
    mockedAxios.postForm.mockResolvedValue({ data: { text: 'ciao' } });
    const stt = new HttpSpeechToText(
      config({ STT_HTTP_URL: 'http://speech.example.org:8443/' }),
    );

    const res = await stt.text(Buffer.from('RIFF'), 'it-IT');

    expect(res).toEqual({ text: 'ciao' });
    const [url, form] = mockedAxios.postForm.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(url).toBe('http://speech.example.org:8443/v1/transcribe');
    const body = formText(form);
    expect(body).toMatch(/name="audio"; filename="audio.wav"/);
    expect(body).toMatch(/name="language"\r\n\r\nit\r\n/);
  });

  it('omits the language when none is given, letting the service detect it', async () => {
    mockedAxios.postForm.mockResolvedValue({ data: { text: '' } });
    const stt = new HttpSpeechToText(config({ STT_HTTP_URL: 'http://x' }));

    const res = await stt.text(Buffer.from('RIFF'), '');

    expect(res).toEqual({ text: '' });
    const form = mockedAxios.postForm.mock.calls[0][1] as FormData;
    expect(formText(form)).not.toMatch(/name="language"/);
  });

  it('fails without STT_HTTP_URL', async () => {
    const stt = new HttpSpeechToText(config({}));
    await expect(stt.text(Buffer.from('RIFF'), 'it')).rejects.toThrow(
      /STT_HTTP_URL/,
    );
  });
});
