import { Transform } from 'stream';
import { LLMModelAdapter } from '../../../adapter';
import { TudaLLama3ChatMessageStream } from './tuda.llama3.stream';

export class TudaLLama3ModelAdapter extends LLMModelAdapter {
  getStreamAdapter(): Transform {
    return new TudaLLama3ChatMessageStream();
  }
}
