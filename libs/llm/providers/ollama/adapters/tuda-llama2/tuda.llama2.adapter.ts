import { Transform } from 'stream';
import { LLMModelAdapter } from '../../../adapter';
import { TudaLLama2ChatMessageStream } from './tuda.llama2.stream';

export class TudaLLama2ModelAdapter extends LLMModelAdapter {
  getStreamAdapter(): Transform {
    return new TudaLLama2ChatMessageStream();
  }
}
