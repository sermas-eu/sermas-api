import { Transform } from 'stream';

export abstract class LLMModelAdapter {
  getStreamAdapter?(): Transform | undefined;
}
