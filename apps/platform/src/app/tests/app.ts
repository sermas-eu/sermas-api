export const newApp = (appId: string, ownerId: string) => ({
  appId,
  name: appId,
  ownerId,
  modules: [],
  repository: {
    avatars: {},
    backgrounds: {},
  },
  clients: [],
});
