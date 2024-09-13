import * as hb from 'handlebars';

export interface PromptTemplateParams {}

export class PromptTemplate<T = any> {
  static create<T = any>(prompt: string) {
    return new PromptTemplate<T>(prompt);
  }

  private template: HandlebarsTemplateDelegate<T>;

  constructor(
    private readonly prompt: string,
    private readonly args?: T,
    private readonly params?: PromptTemplateParams,
  ) {
    this.template = hb.compile(this.prompt);
  }

  render(data?: T) {
    const args: any = data || this.args || {};
    return this.template(args);
  }
}
