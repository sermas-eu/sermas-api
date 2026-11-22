// Route metadata read by the guards in this lib.
export const META_PUBLIC = 'sermas:auth:public';
export const META_RESOURCE = 'sermas:auth:resource';
export const META_SCOPES = 'sermas:auth:scopes';
export const META_ROLES = 'sermas:auth:roles';
export const META_CREATES_APP = 'sermas:auth:creates-app';

// Cookie checked when no Authorization header is sent (kept from the previous
// keycloak-connect setup).
export const TOKEN_COOKIE = 'KEYCLOAK_JWT';
