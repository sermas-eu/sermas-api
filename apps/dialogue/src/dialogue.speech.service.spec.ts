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
      });
      const ok = await service.convertToText(
        { appId: 'a', sessionId: 's', language: 'en-GB' },
        async () => expectedSpeaker,
      );
      return { ok, progress };
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
