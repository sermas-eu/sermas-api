import { DialogueToolsTriggerService } from './dialogue.tools.trigger.service.js';

// D-43: a tool can carry UI content, shown in the session that triggered it
const service = () => {
  const ui = { showContent: vi.fn(async () => undefined) };
  const s = new DialogueToolsTriggerService(
    { emit: vi.fn() } as any,
    {} as any,
    { readApp: vi.fn(async () => ({ appId: 'a1' })) } as any,
    {} as any,
    {} as any,
    ui as any,
  );
  return { s, ui };
};

const tool = (extra: Record<string, unknown> = {}) => ({
  name: 'show-architecture',
  description: 'show the architecture',
  ...extra,
});

describe('tool UI content', () => {
  it('shows the content in the session', async () => {
    const { s, ui } = service();
    await s.trigger({
      appId: 'a1',
      sessionId: 's1',
      repositoryId: 'a1',
      name: 'show-architecture',
      schema: tool({
        ui: {
          contentType: 'image',
          content: { src: '/img/arch.png', alt: 'Architecture' },
        },
      }),
      values: {},
    });
    expect(ui.showContent).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'a1',
        sessionId: 's1',
        contentType: 'image',
        content: { src: '/img/arch.png', alt: 'Architecture' },
      }),
    );
  });

  it('shows nothing for a tool without UI content, or without a session', async () => {
    const { s, ui } = service();
    await s.trigger({
      appId: 'a1',
      sessionId: 's1',
      repositoryId: 'a1',
      name: 'plain',
      schema: tool(),
      values: {},
    });
    await s.trigger({
      appId: 'a1',
      sessionId: undefined as unknown as string,
      repositoryId: 'a1',
      name: 'show-architecture',
      schema: tool({ ui: { contentType: 'image', content: { src: 'x' } } }),
      values: {},
    });
    expect(ui.showContent).not.toHaveBeenCalled();
  });
});
