import { AppClientDto } from 'apps/platform/src/app/platform.app.dto';

export const getKeycloakClientId = (
  appId: string | AppClientDto | { appId: string; clientId: string },
  clientId?: string,
): string => {
  if (typeof appId !== 'string') {
    clientId = appId.clientId;
    appId = appId.appId;
  }

  const kcClientId = `${appId}-${clientId}`;
  return kcClientId;
};
