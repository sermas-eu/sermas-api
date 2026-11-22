import { describe, expect, it, vi } from 'vitest';
import { DialogueToolsEventsService } from '../tools/dialogue.tools.events.service.js';
import { DialogueQuizService } from './dialogue.quiz.service.js';

describe('DialogueQuizService', () => {
  const make = (llmMessage?: string) => {
    const chat = vi.fn(async () => undefined);
    const llm = vi.fn(async () =>
      llmMessage === undefined ? null : { message: llmMessage },
    );
    const service = new DialogueQuizService(
      { chat } as any,
      {
        getLanguage: async () => 'it-IT',
        getSettings: async () => ({ language: 'en-GB' }),
        getAvatar: async () => ({ gender: 'F', name: 'Pip' }),
        getLLM: async () => undefined,
      } as any,
      { chat: llm, extractProviderName: () => ({}) } as any,
    );
    return { service, chat, llm };
  };

  // the trigger of a quiz answer's UI tool, as onUiInteraction emits it
  const answer = (overrides: Record<string, any> = {}) => ({
    name: 'f1',
    appId: 'a',
    sessionId: 's',
    repositoryId: 'r',
    source: 'ui',
    values: {},
    schema: {
      name: 'f1',
      description: 'Eight',
      schema: [
        {
          parameter: 'selection',
          type: 'string',
          value: 'Eight',
          ignore: true,
        },
        { parameter: 'answerId', type: 'string', value: 'eight', ignore: true },
        {
          parameter: 'question',
          type: 'string',
          value: 'How many modules?',
          ignore: true,
        },
        { parameter: 'correct', type: 'boolean', value: true, ignore: true },
        {
          parameter: 'reason',
          type: 'string',
          value: 'Right, there are eight.',
          ignore: true,
        },
      ],
    },
    ...overrides,
  });

  it('asks the LLM about the answer and speaks its comment in the session language', async () => {
    const { service, chat, llm } = make('Esatto, sono otto moduli.');
    await service.onQuizAnswer(answer() as any);
    const prompt = (llm.mock.calls[0] as any[])[0].user.toString();
    expect(prompt).toContain('How many modules?');
    expect(prompt).toContain('USER ANSWER: Eight');
    expect(prompt).toContain('THE ANSWER IS: correct');
    expect(prompt).toContain('Right, there are eight.');
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'agent',
        sessionId: 's',
        language: 'it-IT',
        text: 'Esatto, sono otto moduli.',
      }),
    );
  });

  it('falls back to the reason, in the app language, when the LLM fails', async () => {
    const { service, chat } = make(undefined);
    await service.onQuizAnswer(answer() as any);
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'en-GB',
        text: 'Right, there are eight.',
      }),
    );
  });

  it('ignores other tools and triggers that do not come from the UI', async () => {
    const { service, chat, llm } = make('x');
    await service.onQuizAnswer(answer({ source: 'agent' }) as any);
    await service.onQuizAnswer(
      answer({
        schema: {
          name: 'f2',
          description: 'Take a quiz',
          schema: [{ parameter: 'value', type: 'string', value: 'tool/q' }],
        },
      }) as any,
    );
    expect(llm).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
  });
});

describe('quiz content as UI tools', () => {
  it('each answer tool carries the question, correct and reason, ignored by the LLM', async () => {
    const add = vi.fn(async () => undefined);
    const events = new DialogueToolsEventsService(
      {} as any,
      { add, search: async () => [] } as any,
      {} as any,
    );
    await events.addToolsContent({
      appId: 'a',
      sessionId: 's',
      contentType: 'quiz',
      content: {
        question: 'How many modules?',
        answers: [
          { answerId: 'four', answer: 'Four', correct: false, reason: 'More.' },
          { answerId: 'eight', answer: 'Eight', correct: true, reason: 'Yes.' },
        ],
      },
    } as any);
    const tools = (add.mock.calls[0] as any[])[0].tools;
    const params = (i: number) =>
      Object.fromEntries(
        tools[i].schema.map((p: any) => [p.parameter, [p.value, p.ignore]]),
      );
    expect(params(0)).toMatchObject({
      answerId: ['four', true],
      question: ['How many modules?', true],
      correct: [false, true],
      reason: ['More.', true],
    });
    expect(params(1).correct).toEqual([true, true]);
  });
});
