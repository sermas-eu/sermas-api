import { Transform } from 'stream';
import { LLMPromptArgs } from '../llm.provider.dto';

export abstract class LLMModelAdapter {
  getStreamAdapter?(): Transform | undefined;
  createPrompt?(args: LLMPromptArgs): string;
}
