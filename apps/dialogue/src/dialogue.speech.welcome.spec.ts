import { DialogueWelcomeService } from './dialogue.speech.welcome.service.js';

// D-44: the LLM only rephrases the button labels; without its labels the
// buttons were dropped altogether
describe('welcome buttons', () => {
  const run = async (llmResponse: unknown, tasks: unknown[]) => {
    const showContent = vi.fn(async () => undefined);
    const service = Object.create(DialogueWelcomeService.prototype);
    Object.assign(service, {
      logger: {
        verbose: () => undefined,
        debug: () => undefined,
        warn: () => undefined,
      },
      app: { readApp: async () => ({ appId: 'a1', settings: {} }) },
      session: {
        getSettings: async () => ({ language: 'en-GB' }),
        getAvatar: async () => ({ gender: 'F' }),
        getLLM: async () => undefined,
      },
      tasks: { list: async () => tasks },
      tools: { loadFromSession: async () => [] },
      emotion: { getUserEmotion: async () => undefined },
      monitor: { performance: () => () => undefined },
      llmProvider: {
        chat: async () => llmResponse,
        extractProviderName: () => ({}),
      },
      speech: { chat: async () => undefined },
      uiService: { showContent },
    });
    await service.handleWelcomeText({
      operation: 'created',
      appId: 'a1',
      record: { sessionId: 's1' },
    });
    return showContent;
  };

  const feedback = { taskId: 'feedback', label: 'Leave feedback' };

  it('shows the buttons with the original labels when the LLM gives none', async () => {
    const show = await run({ message: 'Hi', labels: [] }, [feedback]);
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'buttons',
        content: {
          label: '',
          list: [{ label: 'Leave feedback', value: 'task/feedback' }],
        },
      }),
    );
  });

  it('uses the rephrased labels', async () => {
    const show = await run({ message: 'Hi', labels: ['Tell us'] }, [feedback]);
    expect((show.mock.calls[0] as any)[0].content.list[0].label).toBe(
      'Tell us',
    );
  });

  it('shows nothing without tools or tasks, and survives a failed LLM call', async () => {
    expect(await run({ message: 'Hi', labels: [] }, [])).not.toHaveBeenCalled();
    expect(await run(null, [feedback])).toHaveBeenCalled();
  });

  it('lists a task enabled as a tool once', async () => {
    const show = vi.fn(async () => undefined);
    const service = Object.create(DialogueWelcomeService.prototype);
    Object.assign(service, {
      logger: { verbose: () => undefined, debug: () => undefined },
      app: { readApp: async () => ({ appId: 'a1', settings: {} }) },
      session: {
        getSettings: async () => ({ language: 'en-GB' }),
        getAvatar: async () => ({}),
        getLLM: async () => undefined,
      },
      tasks: { list: async () => [feedback] },
      tools: {
        loadFromSession: async () => [
          {
            tools: [
              {
                name: 'show-architecture',
                description: 'Show the architecture',
              },
              {
                name: 'leave-feedback',
                description: 'Leave feedback',
                schema: [{ parameter: 'taskId', value: 'feedback' }],
              },
            ],
          },
        ],
      },
      emotion: { getUserEmotion: async () => undefined },
      monitor: { performance: () => () => undefined },
      llmProvider: { chat: async () => null, extractProviderName: () => ({}) },
      speech: { chat: async () => undefined },
      uiService: { showContent: show },
    });
    await service.handleWelcomeText({
      operation: 'created',
      appId: 'a1',
      record: { sessionId: 's1' },
    });
    const values = (show.mock.calls[0] as any)[0].content.list.map(
      (b: any) => b.value,
    );
    expect(values).toEqual(['tool/show-architecture', 'task/feedback']);
  });

  // a welcome button that runs a tool: the tool runs, then its content gets a line
  it('a tool button triggers the tool and speaks a line about its content', async () => {
    const tool = {
      name: 'show-architecture',
      description: 'How it works',
      ui: { contentType: 'image', content: { alt: 'Diagram' } },
    };
    const trigger = vi.fn();
    const present = vi.fn(async () => undefined);
    const service = Object.create(DialogueWelcomeService.prototype);
    Object.assign(service, {
      tools: {
        getSchemaValue: (schema: any, key: string) =>
          schema.schema.find((p: any) => p.parameter === key)?.value,
        get: async () => ({ tools: [tool] }),
        trigger,
      },
      toolContent: { present },
    });
    await service.handleWelcomeTool({
      appId: 'a1',
      sessionId: 's1',
      schema: {
        name: 'f1',
        description: 'See how it works : ',
        schema: [
          { parameter: 'selection', value: 'See how it works : ' },
          { parameter: 'value', value: 'tool/show-architecture' },
          { parameter: 'context', value: 'welcome-tools' },
        ],
      },
    });
    expect(trigger).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'show-architecture' }),
    );
    expect(present).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 's1' }),
      tool,
      'See how it works',
    );
  });
});
