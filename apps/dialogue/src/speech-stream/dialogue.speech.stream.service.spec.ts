import { DialogueSpeechStreamService } from './dialogue.speech.stream.service.js';

// a cache whose reads and writes take a random while, as Redis round trips do
const slowCache = () => {
  const store = new Map<string, Buffer>();
  const pause = () =>
    new Promise((r) => setTimeout(r, Math.floor(Math.random() * 3)));
  return {
    get: async (k: string) => {
      await pause();
      return store.get(k);
    },
    set: async (k: string, v: Buffer) => {
      await pause();
      store.set(k, Buffer.from(v));
    },
    del: async (k: string) => {
      store.delete(k);
    },
  };
};

describe('DialogueSpeechStreamService', () => {
  it('keeps every frame of a chunk, in order, when messages arrive back to back', async () => {
    const received: Buffer[] = [];
    const service = new DialogueSpeechStreamService(
      {
        read: async () => ({ sessionId: 's', appId: 'a', settings: {} }),
      } as any,
      {} as any,
      slowCache() as any,
    );
    (service as any).processMessage = async (m: { buffer: Buffer }) => {
      received.push(m.buffer);
    };

    const topic = 'app/a/dialogue/user-speech/stream/s/c1';
    const frames = Array.from({ length: 30 }, (_, i) =>
      Buffer.from([i * 2, 0]),
    );
    // as the MQTT explorer does: handlers fired without awaiting
    const pending = frames.map((f) => service.processStreamFrame(topic, f));
    pending.push(
      service.processStreamFrame(
        topic,
        Buffer.from(JSON.stringify({ isSpeech: true })),
      ),
    );
    await Promise.all(pending);

    expect(received).toHaveLength(1);
    const pcm = received[0].subarray(44);
    expect(pcm.length).toBe(60);
    expect([...pcm.filter((_, i) => i % 2 === 0)]).toEqual(
      frames.map((f) => f[0]),
    );
  });
});
