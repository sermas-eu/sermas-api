export type PlatformTopicMap = Record<string, Record<string, string>>;

export class PlatformTopic {
  resource: string;
  scope: string;
  context?: string[];
  prefix?: string;
}
