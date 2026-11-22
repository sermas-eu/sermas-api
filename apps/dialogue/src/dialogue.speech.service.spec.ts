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
});
