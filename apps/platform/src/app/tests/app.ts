import { PlatformAppDto } from '../platform.app.dto';

export const newApp = (
  appId: string,
  ownerId: string,
): Partial<PlatformAppDto> => ({
  appId,
  name: appId,
  ownerId,
  modules: [],
  repository: {
    avatars: [],
    backgrounds: [],
    robots: [],
    documents: [],
    animations: [],
  },
  clients: [],
});
