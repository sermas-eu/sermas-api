import { DialogueToolsService } from './dialogue.tools.service.js';

// D-46: a session got either its own repositories or the app's, never both, and
// the app's tasks-as-tools shared the app repository (concurrent writes lost tools)
describe('DialogueToolsService.loadFromSession', () => {
  const repos: Record<string, any> = {
    demo: { repositoryId: 'demo', tools: [{ name: 'show-architecture' }] },
    'demo-tasks': {
      repositoryId: 'demo-tasks',
      tools: [{ name: 'leave-feedback' }],
    },
  };
  const service = (sessionRepos: any[]) => {
    const s = Object.create(DialogueToolsService.prototype);
    Object.assign(s, {
      get: async (id: string) => repos[id] || null,
      search: async () => sessionRepos,
    });
    return s as DialogueToolsService;
  };
  const names = (rs: any[]) =>
    rs.flatMap((r) => r.tools.map((t: any) => t.name));

  it('returns the app tools and the app tasks', async () => {
    const rs = await service([]).loadFromSession({
      appId: 'demo',
      sessionId: 's1',
    });
    expect(names(rs)).toEqual(['show-architecture', 'leave-feedback']);
  });

  it('keeps them when the session has its own tools (a running task)', async () => {
    const session = {
      repositoryId: 'r1',
      sessionId: 's1',
      tools: [{ name: 'f-1' }],
    };
    const rs = await service([session]).loadFromSession({
      appId: 'demo',
      sessionId: 's1',
    });
    expect(names(rs)).toEqual(['f-1', 'show-architecture', 'leave-feedback']);
  });
});
