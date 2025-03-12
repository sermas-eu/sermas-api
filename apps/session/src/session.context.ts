import { uuidv4 } from 'libs/util';

export type SessionContext = {
  sessionId?: string;
  appId?: string;
  ts?: Date;
  requestId?: string;
};

export const createSessionContext = (data: {
  requestId?: string;
  sessionId?: string;
  appId?: string;
}): SessionContext | undefined => {
  if (!data.sessionId) return undefined;

  const context: SessionContext = {};

  context.requestId = data.requestId || uuidv4();
  context.sessionId = data.sessionId;
  context.ts = new Date();

  if (data.appId) context.appId = data.appId;

  return context;
};
