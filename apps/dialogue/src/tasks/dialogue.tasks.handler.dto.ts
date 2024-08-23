export interface ToolFieldValuesDto {
  [key: string]: any;
  repositoryId: string;
  taskId: string;
  recordId: string;
  field: string;
  value: string;
}

export interface ValidationResultDto<T = any> {
  error: boolean;
  reason?: string;
  language?: string;
  value?: T;
}
