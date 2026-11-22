import { describe, expect, it, vi } from 'vitest';
import { DialogueToolContentService } from './dialogue.tool-content.service.js';

describe('DialogueToolContentService', () => {
  const make = (llmMessage?: string) => {
    const chat = vi.fn(async () => undefined);
    const llm = vi.fn(async () =>
      llmMessage === undefined ? null : { message: llmMessage },
    );
    const service = new DialogueToolContentService(
      { chat } as any,
      {
        getLanguage: async () => 'it-IT',
        getSettings: async () => ({}),
        getAvatar: async () => ({ gender: 'F', name: 'Pip' }),
        getLLM: async () => undefined,
      } as any,
      { chat: llm, extractProviderName: () => ({}) } as any,
    );
    return { service, chat, llm };
  };
  const ev = { appId: 'a', sessionId: 's' };
  const image = {
    name: 'show-architecture',
    description: 'The user asks how it works',
    ui: {
      contentType: 'image',
      content: { src: '/a.png', alt: 'The architecture diagram' },
    },
  };

  it('speaks an LLM line about the content, from its own words, in the session language', async () => {
    const { service, chat, llm } = make('Ecco lo schema dell’architettura.');
    await service.present(ev, image as any, 'See how it works');
    const prompt = (llm.mock.calls[0] as any[])[0].user.toString();
    expect(prompt).toContain('The user chose "See how it works"');
    expect(prompt).toContain('The architecture diagram');
    expect(prompt).not.toContain('QR code');
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'agent',
        language: 'it-IT',
        text: 'Ecco lo schema dell’architettura.',
      }),
    );
  });

  it('for a link, points at the QR code; falls back to a fixed English line', async () => {
    const { service, chat, llm } = make(undefined);
    const link = {
      name: 'open-docs',
      description: 'The user wants the docs',
      ui: {
        contentType: 'link',
        content: { url: 'https://example.org', label: 'The guide' },
      },
    };
    await service.present(ev, link as any, 'Get the guide');
    expect((llm.mock.calls[0] as any[])[0].user.toString()).toContain(
      'QR code',
    );
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'en-GB',
        text: expect.stringMatching(/QR code/),
      }),
    );
  });

  it('says nothing for a tool without content, or one that opts out', async () => {
    const { service, chat } = make('x');
    await service.present(ev, { name: 't', description: 'd' } as any, 'x');
    await service.present(ev, { ...image, skipResponse: true } as any, 'x');
    expect(chat).not.toHaveBeenCalled();
  });
});
