export interface LLMTool {
  name: string;
  description: string;
  schema?: ToolParam[];
  returnDirect?: boolean;
  emitter?: string;
  request?: ToolRequestConfig;
}

export const ToolSchemaTypeList = [
  'string',
  'number',
  'boolean',
  'object',
] as const;

export type ToolParamType = (typeof ToolSchemaTypeList)[number];

export interface ToolParam {
  parameter: string;
  type: ToolParamType;
  description: string;
  required?: boolean;
  value?: string | number | boolean | object;
  ignore?: boolean;
}

export interface ToolRequestConfig {
  auth: 'basic' | 'bearer' | 'module';
  moduleId: string;
  url?: string;
}

export interface SelectedTool<T = { [param: string]: any }> {
  name: string;
  schema?: LLMTool;
  values?: T;
}

export interface ToolResponse {
  type: 'tools';
  data: SelectedTool[];
}

export interface AnswerResponse {
  type: 'answer';
  data: string;
}

export type ToolWithAnswerResponse = AnswerResponse | ToolResponse;

export type LLMToolsResponse = {
  tools: SelectedTool[];
  answer?: string;
};
