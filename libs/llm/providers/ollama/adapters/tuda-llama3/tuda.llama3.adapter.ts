import { Logger } from '@nestjs/common';
import { LLMPromptArgs } from 'libs/llm/llm.provider.dto';

import { appendFileSync, mkdirSync } from 'fs';
import { Transform } from 'stream';
import { LLMModelAdapter } from '../../../adapter';
import { TudaLLama3ChatMessageStream } from './tuda.llama3.stream';

export class TudaLLama3ModelAdapter extends LLMModelAdapter {
  private logger = new Logger(TudaLLama3ModelAdapter.name);

  constructor() {
    super();
    if (process.env.LOG_LLAMA3 === '1') {
      mkdirSync('./tmp', { recursive: true });
    }
  }

  createPrompt(args: LLMPromptArgs): string {
    if (args.system) return undefined;

    let history = args.history
      ? args.history
          .map(
            (t) => `${t.role === 'user' ? 'USER:' : 'ASSISTANT:'} ${t.content}`,
          )
          .join('\n') + '\n'
      : '';

    if (args.message) history += `USER: ${args.message}`;

    const emotion = args.params?.emotion || 'neutral';

    console.warn('****TODO********* tuda llama3');

    // const chatPrompt = new ChatPrompt(args);
    // const prompt = chatPrompt.mapPrompt({
    //   prompt: llama3Prompt,
    //   params: {
    //     knowledge: args.knowledge || '',
    //     history,
    //     emotion,
    //   },
    // });

    const prompt = '';

    this.logger.debug(`PROMPT [`);
    prompt.split('\n').map((t) => this.logger.debug(`PROMPT  ${t}`));
    this.logger.debug(`PROMPT ]`);

    if (process.env.LOG_LLAMA3 === '1') {
      appendFileSync('./tmp/llama.log', `\n\n---\nPROMPT\n${prompt}`);
    }

    return prompt;
  }

  getStreamAdapter(): Transform {
    return new TudaLLama3ChatMessageStream();
  }
}
