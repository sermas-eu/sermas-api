import { collectAppIds, collectSessionIds } from './platform.auth.guard.js';

describe('PlatformGuard request parsing', () => {
  it('collects the appIds of path, query and body', () => {
    expect(
      collectAppIds({
        params: { appId: 'a' },
        query: { appId: 'a' },
        body: { appId: 'a' },
      }),
    ).toEqual(['a']);
    expect(
      collectAppIds({ params: { appId: 'a' }, body: { appId: 'b' } }),
    ).toEqual(['a', 'b']);
  });

  it('reads every item of an array body', () => {
    expect(
      collectAppIds({ body: [{ appId: 'a' }, { appId: 'b' }, {}] }),
    ).toEqual(['a', 'b']);
  });

  it('ignores non-string values', () => {
    expect(
      collectAppIds({ query: { appId: ['a', 'b'] }, body: { appId: 1 } }),
    ).toEqual([]);
  });

  it('collects sessionIds the same way', () => {
    expect(
      collectSessionIds({
        params: { sessionId: 's1' },
        body: { sessionId: 's2' },
      }),
    ).toEqual(['s1', 's2']);
  });
});
