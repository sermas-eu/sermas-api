import { Eta } from 'eta';
import { LLMProvider } from '../providers/provider.dto';

let engine: Eta;

const init = () => {
  if (engine) return;
  engine = new Eta({
    /** Whether or not to automatically XML-escape interpolations. Default true */
    autoEscape: false,
    /** Whether or not to cache templates if `name` or `filename` is passed */
    cache: true,
    /** Make data available on the global object instead of varName */
    useWith: false,
    /** Name of the data object. Default `it` */
    varName: 'data',
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

export type PromptRenderCallback = (
  data?: any,
  params?: PromptTemplateParams,
) => PromptTemplateOutput;

export type PromptTemplateOutput = string & {
  getPromptTemplate: () => PromptTemplate;
};

export interface PromptTemplateParams {
  provider: LLMProvider;
  model: string;
}

const getTemplateName = (
  name: string,
  params?: Partial<PromptTemplateParams>,
) => {
  let template = name;
  if (params && params.provider && params.model) {
    template = `${params.provider}/${params.model}/${name}`;
  }
  return `@${template}`;
};

export class PromptTemplate<T extends object = any> {
  private readonly name: string;
  private readonly templateName: string;

  private args: T;

  static create<T extends object = any>(
    name: string,
    prompt: string,
    defaults?: T,
    params?: Partial<PromptTemplateParams>,
  ): PromptRenderCallback {
    const template = new PromptTemplate<T>(name, prompt, defaults, params);

    return (
      data?: T,
      params?: Partial<PromptTemplateParams>,
    ): PromptTemplateOutput => template.render(data, params);
  }

  // check if an overridden template exists
  static exists(
    params: PromptTemplateParams & {
      name: string;
    },
  ) {
    return engine.templatesSync.get(getTemplateName(params.name, params))
      ? true
      : false;
  }

  constructor(
    name: string,
    private readonly prompt: string,
    private readonly defaultArgs?: T,
    private readonly params?: Partial<PromptTemplateParams>,
  ) {
    init();

    this.name = name;

    const template = this.createTemplateName(name, this.params);
    this.templateName = template;

    engine.loadTemplate(this.templateName, this.prompt);
  }

  getName() {
    return this.name;
  }

  getTemplateName() {
    return this.templateName;
  }

  private createTemplateName(
    name: string,
    params?: Partial<PromptTemplateParams>,
  ) {
    return getTemplateName(name, params);
  }

  setArgs(args: T) {
    this.args = {
      ...(this.defaultArgs || {}),
      ...(this.args || {}),
      ...(args || {}),
    } as any;
    return this;
  }

  getArgs() {
    return this.args;
  }

  render(
    data?: T,
    params?: Partial<PromptTemplateParams>,
  ): PromptTemplateOutput {
    this.setArgs(data);
    const template = this.createTemplateName(this.name, params);

    const output = engine.render(
      template,
      this.getArgs(),
    ) as unknown as PromptTemplateOutput;

    output.getPromptTemplate = () => this;

    return output;
  }

  toString() {
    return this.render();
  }
}
