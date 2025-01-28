export type SessionContext = { sessionId?: string; appId?: string; ts?: Date };

export const createSessionContext = (data: {
  sessionId?: string;
  appId?: string;
}): SessionContext | undefined => {
  if (!data.sessionId) return undefined;

  const context: SessionContext = {};

  context.sessionId = data.sessionId;
  context.ts = new Date();

  if (data.appId) context.appId = data.appId;

  return context;
};
