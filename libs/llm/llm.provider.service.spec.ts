import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LLMProviderService } from './llm.provider.service.js';
import { OpenAIChatProvider } from './providers/openai/openai.chat.provider.js';

const env: Record<string, any> = {
  OPENAI_API_KEY: 'test',
  OPENAI_MODEL: 'chat',
  LLM_TEMPERATURE: 0.3,
  LLM_TOP_P: 0.3,
  LLM_REASONING_EFFORT: 'none',
};

describe('LLMProviderService chat provider settings', () => {
  beforeEach(() => {
    vi.spyOn(OpenAIChatProvider.prototype, 'checkModel').mockResolvedValue(
      true,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  const createService = (overrides: Record<string, any> = {}) => {
    const values = { ...env, ...overrides };
    const config = { get: (key: string) => values[key] } as ConfigService;
    return new LLMProviderService(
      config,
      new EventEmitter2(),
      {} as any,
      {} as any,
    );
  };

  const requestOf = async (service: LLMProviderService) => {
    const provider = (await service.getChatProvider({})) as OpenAIChatProvider;
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'ok' } }],
    });
    (provider as any).openai = { chat: { completions: { create } } };
    await provider.call([{ role: 'user', content: 'hi' }], { stream: false });
    return create.mock.calls[0][0];
  };

  it('sends temperature, top_p and reasoning_effort from the configuration', async () => {
    const req = await requestOf(createService());
    expect(req).toMatchObject({
      model: 'chat',
      temperature: 0.3,
      top_p: 0.3,
      reasoning_effort: 'none',
    });
  });

  it('leaves reasoning_effort out when it is not configured', async () => {
    const req = await requestOf(createService({ LLM_REASONING_EFFORT: '' }));
    expect(req).not.toHaveProperty('reasoning_effort');
  });
});
