import { PromptMessage, PromptTemplate } from './template';

export class GenericPromptTemplate implements PromptTemplate {
  opening() {
    return '';
  }

  addMessage(role: 'system' | 'assistant' | 'user', message: string) {
    return `${role.toUpperCase()}: ${message}\n`;
  }

  closure() {
    return '';
  }

  generate(messages: PromptMessage[]) {
    return `${this.opening()}${messages
      .sort((a) => (a.role === 'system' ? -1 : 1))
      .map((m) => this.addMessage(m.role, m.message))}${this.closure()}`;
  }
}
