import { PromptMessage, PromptTemplate } from './template';

// https://llama.meta.com/docs/model-cards-and-prompt-formats/meta-llama-3/
export class Llama3PromptTemplate implements PromptTemplate {
  opening() {
    return '<|begin_of_text|>';
  }

  addMessage(role: 'system' | 'assistant' | 'user', message: string) {
    return `<|start_header_id|>${role}<|end_header_id|>${message}<|eot_id|>\n`;
  }

  closure() {
    return '<|start_header_id|>assistant<|end_header_id|>';
  }

  generate(messages: PromptMessage[]) {
    return `${this.opening()}${messages
      .sort((a) => (a.role === 'system' ? -1 : 1))
      .map((m) => this.addMessage(m.role, m.message))}${this.closure()}`;
  }
}
