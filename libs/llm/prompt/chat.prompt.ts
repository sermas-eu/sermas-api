import { Logger } from '@nestjs/common';
import { LLMPromptArgs } from '../llm.provider.dto';
import { BasePrompt } from './base.prompt';

export class ChatPrompt extends BasePrompt {
  protected logger = new Logger(ChatPrompt.name);

  constructor(private readonly data: LLMPromptArgs) {
    super();
  }

  toString() {
    return this.createPrompt(this.data);
  }
}
