import { createSecret } from 'libs/util';
import {
  KeycloakClientCreateDto,
  KeycloakClientDataDto,
} from '../keycloack.authz.dto';

export const clientDefaultConfiguration = (
  config: Partial<KeycloakClientDataDto> = {},
): KeycloakClientCreateDto => {
  const clientSpecific: any = {
    ...(config.client || {}),
  };

  clientSpecific.secret = clientSpecific.secret || createSecret();

  if (config.public) {
    clientSpecific.publicClient = true;
    clientSpecific.implicitFlowEnabled = true;
    clientSpecific.directAccessGrantsEnabled = true;
    clientSpecific.serviceAccountsEnabled = false;
  } else {
    clientSpecific.publicClient = false;
    clientSpecific.authorizationServicesEnabled =
      clientSpecific.authorizationServicesEnabled === undefined
        ? true
        : clientSpecific.authorizationServicesEnabled;
    clientSpecific.implicitFlowEnabled = false;
    clientSpecific.directAccessGrantsEnabled = true;
    clientSpecific.serviceAccountsEnabled = true;
    clientSpecific.authorizationSettings = {
      allowRemoteResourceManagement: true,
      decisionStrategy: 'AFFIRMATIVE',
      policyEnforcementMode: 'ENFORCING',
      resources: config.resources,
      scopes: config.scopes,
      policies: config.policies,
    };
  }

  return {
    ...clientSpecific,
    enabled: true,
    standardFlowEnabled: true,
    fullScopeAllowed: true,
    surrogateAuthRequired: false,
    webOrigins: ['*'],
    redirectUris: clientSpecific.redirectUris || ['/*'],
    rootUrl: '',
    baseUrl: '',
  };
};
