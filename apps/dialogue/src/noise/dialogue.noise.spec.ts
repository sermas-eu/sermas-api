import { DialogueNoiseService } from './dialogue.noise.service.js';
import { TurnFailureTracker } from './turn-failure.tracker.js';
import { wavStats } from './wav.stats.js';

describe('TurnFailureTracker', () => {
  const tracker = () =>
    new TurnFailureTracker({
      threshold: 3,
      windowMs: 60_000,
      cooldownMs: 120_000,
    });

  it('fires at the threshold, within the window', () => {
    const t = tracker();
    expect(t.drop('s', 0)).toBe(false);
    expect(t.drop('s', 10_000)).toBe(false);
    expect(t.drop('s', 20_000)).toBe(true);
  });

  it('forgets drops older than the window', () => {
    const t = tracker();
    t.drop('s', 0);
    t.drop('s', 10_000);
    expect(t.drop('s', 70_001)).toBe(false);
  });

  it('an answered turn resets the run', () => {
    const t = tracker();
    t.drop('s', 0);
    t.drop('s', 1000);
    t.answered('s');
    expect(t.drop('s', 2000)).toBe(false);
  });

  it('suggests at most once per cooldown', () => {
    const t = tracker();
    [0, 1, 2].forEach((i) => t.drop('s', i * 1000));
    expect([3, 4, 5].map((i) => t.drop('s', i * 1000))).toEqual([
      false,
      false,
      false,
    ]);
    expect([130, 131, 132].map((i) => t.drop('s', i * 1000))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('keeps sessions apart and clears them', () => {
    const t = tracker();
    t.drop('a', 0);
    t.drop('a', 1);
    expect(t.drop('b', 2)).toBe(false);
    t.clear('a');
    t.clear('b');
    expect(t.size()).toBe(0);
  });
});

describe('wavStats', () => {
  const header = (dataBytes: number, bits = 16, format = 1) => {
    const b = Buffer.alloc(44 + dataBytes);
    b.write('RIFF', 0, 'ascii');
    b.writeUInt32LE(36 + dataBytes, 4);
    b.write('WAVE', 8, 'ascii');
    b.write('fmt ', 12, 'ascii');
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(format, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(16000, 24);
    b.writeUInt32LE(32000, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(bits, 34);
    b.write('data', 36, 'ascii');
    b.writeUInt32LE(dataBytes, 40);
    return b;
  };

  it('measures duration and level of 16-bit PCM', () => {
    const b = header(32000); // 1 s at 16 kHz
    for (let i = 0; i < 16000; i++)
      b.writeInt16LE(i % 2 ? 16384 : -16384, 44 + i * 2);
    const s = wavStats(b)!;
    expect(s.durationMs).toBeCloseTo(1000);
    expect(s.rmsDbfs).toBeCloseTo(-6.02, 1);
  });

  it('reports digital silence as -Infinity', () => {
    expect(wavStats(header(3200))!.rmsDbfs).toBe(-Infinity);
  });

  it('declines what it cannot judge', () => {
    expect(wavStats(undefined)).toBeUndefined();
    expect(
      wavStats(
        Buffer.from('not a wav file at all, but long enough to read......'),
      ),
    ).toBeUndefined();
    expect(wavStats(header(100, 8))).toBeUndefined();
    expect(wavStats(header(100, 16, 3))).toBeUndefined();
  });
});

describe('DialogueNoiseService', () => {
  const make = (llmMessage?: string, threshold = '2') => {
    const progress = vi.fn(async () => undefined);
    const chat = vi.fn(async () => undefined);
    const llm = vi.fn(async () =>
      llmMessage === undefined ? null : { message: llmMessage },
    );
    const service = new DialogueNoiseService(
      {
        get: (k: string) =>
          k === 'DIALOGUE_NOISY_THRESHOLD' ? threshold : undefined,
      } as any,
      { chat } as any,
      {
        getLanguage: async () => 'it-IT',
        getSettings: async () => ({}),
        getAvatar: async () => ({ gender: 'F', name: 'Pip' }),
        getLLM: async () => undefined,
      } as any,
      { chat: llm, extractProviderName: () => ({}) } as any,
      { dialogueProgress: progress } as any,
    );
    return { service, progress, chat, llm };
  };
  const drop = { appId: 'a', sessionId: 's', reason: 'no-speech' as const };

  it('after a run of drops: tells the client, then speaks an LLM line in the session language', async () => {
    const { service, progress, chat, llm } = make(
      'Qui è rumoroso, puoi scrivere con la tastiera.',
    );
    await service.onTurnDropped(drop);
    expect(chat).not.toHaveBeenCalled();
    await service.onTurnDropped(drop);
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'stt',
        status: 'error',
        error: 'noisy',
        sessionId: 's',
      }),
    );
    // a user turn: vLLM refuses a request without one
    expect(llm).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.anything() }),
    );
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'agent',
        language: 'it-IT',
        text: 'Qui è rumoroso, puoi scrivere con la tastiera.',
      }),
    );
  });

  it('falls back to a fixed English line (translated downstream) when the LLM fails', async () => {
    const { service, chat } = make(undefined);
    await service.onTurnDropped(drop);
    await service.onTurnDropped(drop);
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'en-GB',
        text: expect.stringMatching(/keyboard/),
      }),
    );
  });

  it('counts LLM-skipped chatter and resets on an answered turn', async () => {
    const { service, chat } = make('x');
    await service.onValidation({
      appId: 'a',
      sessionId: 's',
      skip: true,
    } as any);
    service.onValidation({ appId: 'a', sessionId: 's', skip: false } as any);
    await service.onValidation({
      appId: 'a',
      sessionId: 's',
      skip: true,
    } as any);
    expect(chat).not.toHaveBeenCalled();
    await service.onValidation({
      appId: 'a',
      sessionId: 's',
      skip: true,
    } as any);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('threshold 0 disables it', async () => {
    const { service, chat, progress } = make('x', '0');
    for (let i = 0; i < 5; i++) await service.onTurnDropped(drop);
    expect(chat).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
  });
});
