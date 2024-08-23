import { Logger } from '@nestjs/common';
import { LLMPromptArgs } from 'libs/llm/llm.provider.dto';

import { ChatPrompt } from 'libs/llm/prompt/chat.prompt';
import { Transform } from 'stream';
import { LLMModelAdapter } from '../../../adapter';
import { llama2Prompt } from './tuda.llama2.prompts';
import { TudaLLama2ChatMessageStream } from './tuda.llama2.stream';

export class TudaLLama2ModelAdapter extends LLMModelAdapter {
  private logger = new Logger(TudaLLama2ModelAdapter.name);

  createPrompt(args: LLMPromptArgs): string {
    const history = args.history
      ? args.history
          .map((t) => `<${t.role === 'user' ? 'user' : 'system'}> ${t.content}`)
          .join('\n') + '\n'
      : '';
    const emotion = args.params?.emotion || 'neutral';

    const chatPrompt = new ChatPrompt(args);

    let prompt = chatPrompt.mapPrompt({
      prompt: llama2Prompt,
      params: {
        history,
        emotion,
      },
    });

    if (args.message) prompt += `<user> ${args.message}`;

    this.logger.debug(`PROMPT [`);
    prompt.split('\n').map((t) => this.logger.debug(`PROMPT  ${t}`));
    this.logger.debug(`PROMPT ]`);

    return prompt;
  }

  getStreamAdapter(): Transform {
    return new TudaLLama2ChatMessageStream();
  }
}
