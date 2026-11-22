import { DialogueTasksEventsService } from './dialogue.tasks.events.service.js';

// D-46: a finished task deleted its tools repository, which for an app-wide task
// was the app's own: every tool of the app was gone until the next import
describe('task tools after a task ends', () => {
  const run = async (task: Record<string, unknown>) => {
    const del = vi.fn(async () => undefined);
    const s = new DialogueTasksEventsService(
      {} as any,
      { read: async () => task } as any,
      {} as any,
      { delete: del } as any,
    );
    await s.onTaskRecodChanged({
      record: { taskId: 't1', status: 'completed' },
    } as any);
    return del;
  };

  it('keeps the tools of an app-wide task', async () => {
    const del = await run({
      taskId: 't1',
      appId: 'demo',
      options: { repositoryId: 'demo-tasks' },
    });
    expect(del).not.toHaveBeenCalled();
  });

  it('removes the tools of a session task', async () => {
    const del = await run({
      taskId: 't1',
      appId: 'demo',
      sessionId: 's1',
      options: { repositoryId: 's1' },
    });
    expect(del).toHaveBeenCalledWith('s1');
  });
});
