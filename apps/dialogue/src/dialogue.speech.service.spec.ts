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
});
