import { avatarSystemChatPrompt } from './dialogue.chat.prompt.js';

describe('avatar chat system prompt', () => {
  it('asks only for the filter when there are no tasks or tools', () => {
    const prompt = String(avatarSystemChatPrompt({}));
    expect(prompt).toContain('<filter>');
    expect(prompt).not.toContain('<intents>');
    expect(prompt).not.toContain('<tools>');
    expect(prompt).not.toContain('# INTENTS');
    expect(prompt).not.toContain('# TOOLS');
    expect(prompt).not.toContain('"explain"');
    expect(prompt).toContain('# CHAT RESPONSE');
  });

  it('asks for intents and tools when the app has them', () => {
    const prompt = String(
      avatarSystemChatPrompt({ hasTasks: true, hasTools: true }),
    );
    expect(prompt).toContain('<intents>');
    expect(prompt).toContain('# INTENTS');
    expect(prompt).toContain('<tools>');
    expect(prompt).toContain('# TOOLS');
  });

  it('asks for explanations only when enabled', () => {
    const prompt = String(
      avatarSystemChatPrompt({ hasTasks: true, hasTools: true, explain: true }),
    );
    expect(prompt.match(/"explain": string/g)).toHaveLength(3);
    expect(prompt).toContain("Set the field 'explain'");
  });
});
