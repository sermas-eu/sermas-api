import { Eta } from 'eta';

let engine: Eta;

const init = () => {
  if (engine) return;
  engine = new Eta({
    /** Whether or not to automatically XML-escape interpolations. Default true */
    autoEscape: false,
    /** Whether or not to cache templates if `name` or `filename` is passed */
    cache: true,
    /** Make data available on the global object instead of varName */
    useWith: true,

    /** Configure automatic whitespace trimming. Default `[false, 'nl']` */
    autoTrim: [false, 'nl'],

    // parse: {
    //   /** Which prefix to use for evaluation. Default `""`, does not support `"-"` or `"_"` */
    //   exec: '',
    //   /** Which prefix to use for interpolation. Default `"="`, does not support `"-"` or `"_"` */
    //   interpolate: '=',
    //   /** Which prefix to use for raw interpolation. Default `"~"`, does not support `"-"` or `"_"` */
    //   raw: '~',
    // },
  });
};
export interface PromptTemplateParams {}
export class PromptTemplate<T extends object = any> {
  static create<T extends object = any>(name: string, prompt: string) {
    const tpl = new PromptTemplate<T>(name, prompt);
    return (data?: T) => tpl.render(data);
  }

  constructor(
    private readonly name: string,
    private readonly prompt: string,
    private readonly args?: T,
    private readonly params?: PromptTemplateParams,
  ) {
    init();
    engine.loadTemplate(`@${this.name}`, this.prompt);
  }

  render(data?: T) {
    const args: any = data || this.args || {};
    return engine.render(`@${this.name}`, args);
  }

  toString() {
    return this.render();
  }
}
