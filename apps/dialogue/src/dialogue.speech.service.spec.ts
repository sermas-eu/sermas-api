import { DialogueSpeechService } from './dialogue.speech.service.js';

const deferred = <T>() => {
  let resolve: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe('DialogueSpeechService.speechToText', () => {
  it('starts STT while the speaker checks are still running', async () => {
    const speaker = deferred<boolean>();
    const order: string[] = [];

    const service = Object.create(DialogueSpeechService.prototype);
    Object.assign(service, {
      trackRequest: () => undefined,
      asyncApi: { dialogueProgress: async () => undefined },
      emitter: { emit: () => undefined },
      requestMonitor: { cancelRequests: () => undefined },
      convert: async (ev: any) => ev.buffer,
      isExpectedSpeaker: () => {
        order.push('speaker check started');
        return speaker.promise;
      },
      convertToText: async (_ev: any, checks: () => Promise<boolean>) => {
        order.push('stt started');
        speaker.resolve(true);
        const expected = await checks();
        order.push(`checks done: ${expected}`);
        return true;
      },
    });

    await service.speechToText({
      appId: 'a',
      sessionId: 's',
      buffer: Buffer.from(''),
    });

    expect(order).toEqual([
      'speaker check started',
      'stt started',
      'checks done: true',
    ]);
  });

  // T-08: a dropped turn is reported, so the kiosk can say so instead of waiting
  describe('convertToText drops a turn and says why', () => {
    const run = async (text: string, expectedSpeaker: boolean) => {
      const progress = vi.fn(async () => undefined);
      const emit = vi.fn();
      const service = Object.create(DialogueSpeechService.prototype);
      Object.assign(service, {
        logger: { debug: () => undefined },
        sttProvider: {
          convertToText: async () => ({
            text,
            dialogueMessagePayload: { appId: 'a', sessionId: 's' },
          }),
        },
        continueAgentSpeech: async () => undefined,
        asyncApi: { dialogueProgress: progress },
        emitter: { emit },
      });
      const ok = await service.convertToText(
        { appId: 'a', sessionId: 's', language: 'en-GB' },
        async () => expectedSpeaker,
      );
      return { ok, progress, emit };
    };

    it('no-speech when nothing was transcribed', async () => {
      const { ok, progress } = await run('', true);
      expect(ok).toBe(false);
      expect(progress).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'stt',
          status: 'error',
          error: 'no-speech',
        }),
      );
    });

    it('other-speaker when the voice is not the session speaker', async () => {
      const { ok, progress } = await run('hello', false);
      expect(ok).toBe(false);
      expect(progress).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', error: 'other-speaker' }),
      );
    });
  });

  // the chunks of one answer reach the client in stream order, even when the
  // first one takes longer to translate ("e tu?" was spoken before "Ciao, sto bene")
  it('delivers agent chunks in stream order', async () => {
    const spoken: string[] = [];
    const published: string[] = [];
    const slowFirst = deferred<void>();
    const service = Object.create(DialogueSpeechService.prototype);
    Object.assign(service, {
      agentDelivery: {},
      logger: { error: () => undefined, debug: () => undefined },
      isRequestOngoing: () => true,
      session: {
        getLanguage: async () => 'it-IT',
        getAvatar: async () => ({ gender: 'F' }),
      },
      asyncApi: {
        dialogueProgress: async () => undefined,
        dialogueMessages: (m: any) => published.push(m.text),
      },
      emitter: { emit: () => undefined },
      translateMessage: async (ev: any) => {
        if (ev.text === 'Hi, I am fine') await slowFirst.promise;
        return ev.text === 'Hi, I am fine' ? 'Ciao, sto bene' : 'e tu?';
      },
      sendAgentSpeech: async (m: any) => {
        spoken.push(m.text);
      },
    });
    const chunk = (text: string) => ({
      actor: 'agent',
      appId: 'a',
      sessionId: 's',
      requestId: 'r1',
      language: 'en-GB',
      text,
    });

    // as the event handler does: not awaited, one call per streamed chunk
    const first = service.handleMessage(chunk('Hi, I am fine'));
    const second = service.handleMessage(chunk('and you?'));
    await new Promise((r) => setTimeout(r, 10));
    expect(spoken).toEqual([]); // the second waits for the first
    slowFirst.resolve();
    await Promise.all([first, second]);

    expect(spoken).toEqual(['Ciao, sto bene', 'e tu?']);
    expect(published).toEqual(['Ciao, sto bene', 'e tu?']);
  });
});

// a run of dropped turns is counted by the noise tracker
describe('DialogueSpeechService dropped turns', () => {
  const wav = (seconds: number, amplitude: number, rate = 16000) => {
    const samples = Math.round(seconds * rate);
    const b = Buffer.alloc(44 + samples * 2);
    b.write('RIFF', 0, 'ascii');
    b.writeUInt32LE(36 + samples * 2, 4);
    b.write('WAVE', 8, 'ascii');
    b.write('fmt ', 12, 'ascii');
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36, 'ascii');
    b.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) {
      const v = Math.round(
        amplitude * 32767 * Math.sin((i / rate) * 2 * Math.PI * 440),
      );
      b.writeInt16LE(v, 44 + i * 2);
    }
    return b;
  };

  const make = () => {
    const progress = vi.fn(async () => undefined);
    const emit = vi.fn();
    const convertToText = vi.fn(async () => true);
    const service = Object.create(DialogueSpeechService.prototype);
    Object.assign(service, {
      logger: { debug: () => undefined },
      configService: { get: () => undefined },
      trackRequest: () => undefined,
      asyncApi: { dialogueProgress: progress },
      emitter: { emit },
      requestMonitor: { cancelRequests: () => undefined },
      continueAgentSpeech: async () => undefined,
      convert: async (ev: any) => ev.buffer,
      isExpectedSpeaker: async () => true,
      convertToText,
    });
    return { service, progress, emit, convertToText };
  };

  it('drops a near-silent clip before STT, as no-speech', async () => {
    const { service, progress, emit, convertToText } = make();
    await service.speechToText({
      appId: 'a',
      sessionId: 's',
      buffer: wav(1, 0.0005),
    });
    expect(convertToText).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'stt',
        status: 'error',
        error: 'no-speech',
      }),
    );
    expect(emit).toHaveBeenCalledWith('dialogue.turn.dropped', {
      appId: 'a',
      sessionId: 's',
      reason: 'no-speech',
    });
  });

  it('drops a clip shorter than the minimum duration', async () => {
    const { service, convertToText } = make();
    await service.speechToText({
      appId: 'a',
      sessionId: 's',
      buffer: wav(0.1, 0.3),
    });
    expect(convertToText).not.toHaveBeenCalled();
  });

  it('sends audible speech-length audio to STT', async () => {
    const { service, convertToText } = make();
    await service.speechToText({
      appId: 'a',
      sessionId: 's',
      buffer: wav(1, 0.3),
    });
    expect(convertToText).toHaveBeenCalled();
  });

  it('sends audio it cannot judge (not 16-bit WAV) to STT', async () => {
    const { service, convertToText } = make();
    await service.speechToText({
      appId: 'a',
      sessionId: 's',
      buffer: Buffer.from('raw'),
    });
    expect(convertToText).toHaveBeenCalled();
  });
});
