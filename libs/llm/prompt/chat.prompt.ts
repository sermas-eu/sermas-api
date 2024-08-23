import { Logger } from '@nestjs/common';
import { LLMPromptArgs } from '../llm.provider.dto';
import { BasePrompt } from './base.prompt';
import { GenericPromptTemplate } from './templates/generic.template';
import { PromptTemplate } from './templates/template';

export class ChatPrompt extends BasePrompt {
  protected logger = new Logger(ChatPrompt.name);
  private template?: PromptTemplate;

  constructor(
    private readonly data: LLMPromptArgs,
    template?: PromptTemplate,
  ) {
    super();
    this.template = template || new GenericPromptTemplate();
  }

  toString() {
    return this.createPrompt(this.data);
  }
}
