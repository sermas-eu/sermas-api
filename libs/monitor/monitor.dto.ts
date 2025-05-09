export class MonitorContextDto {
  label: string;
  sessionId?: string;
  appId?: string;
  threshold?: number;
}

export class MonitorLogDto extends MonitorContextDto {
  label: string;
  sessionId?: string;
  appId?: string;
  value?: any;
  type?: MonitorRecordType;
}

const MonitorRecordTypeList = [
  'performance',
  'consumption',
  'error',
  'log',
] as const;

export type MonitorRecordType = (typeof MonitorRecordTypeList)[number];

export class MonitorRecordDto extends MonitorContextDto {
  type: MonitorRecordType;
  value: number | string;
  unitCost?: number;
  context?: { [key: string]: any };
  ts: Date;
}

export class MonitorResultDto extends MonitorContextDto {
  sessionId: string;
  appId: string;
  cost: number;
  context?: { [key: string]: any };
  ts: Date;
}
