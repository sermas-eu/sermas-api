import { ulid } from 'ulidx';

export const getConfigPath = () => process.env.CONFIG_BASEPATH || '/app/config';

export const getChunkId = (ts?: Date): string =>
  ulid(ts ? new Date(ts).getTime() : undefined);

export const getMessageId = (ts?: Date) => getChunkId(ts);
