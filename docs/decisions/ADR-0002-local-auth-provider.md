# ADR-0002 — An optional local auth provider for single-instance deployments

**Date:** 2026-11-22
**Status:** accepted

## Context

Running SERMAS needs a Keycloak with a database: about 1–1.5 GiB of memory for a
deployment whose API, stores and kiosk need about 2.5 GiB. A demo that shows one app
needs none of what Keycloak adds: no user accounts, no self-registration, no realm
administration. Keycloak is also the largest attack surface of such a deployment.

The API already validates tokens itself (ADR-0001) and decides access with its own
`PlatformGuard`. Keycloak remains in three roles: it issues tokens, it holds each app
client's scopes, and it stores users.

## Decision

`AUTH_PROVIDER=local` replaces Keycloak inside the API. The default stays `keycloak`.

- **Identities from env**: the platform client (`AUTH_KEYCLOAK_CLIENT_ID/SECRET`), the
  kiosk client (`AUTH_KEYCLOAK_KIOSK_CLIENT_*`), optional service clients
  (`AUTH_LOCAL_CLIENTS`) and one admin (`ADMIN_USER/PASSWORD`). An app's clients come from
  its record in MongoDB, with the permissions it declares.
- **Tokens** are RS256 JWTs signed with a key generated at start and kept in memory.
  Refresh tokens are in memory and used once. Access tokens last 12 hours, as in the
  Keycloak realm the API configures. A restart logs everyone out.
- **A Keycloak-compatible subset** under `/api/auth/oidc/realms/<realm>/`: discovery,
  JWKS and the token endpoint (`client_credentials`, `password`, `refresh_token`).
  Clients change a URL, not code.
- **Authorization** keeps `PlatformGuard`. The Keycloak permission evaluation is replaced
  by the client's declared permissions (`*`, `resource.*`, `resource.scope`). The
  platform client is admin-only, and the kiosk client holds no scope.
- **Writes are no-ops** (realm, client resources, roles, user/app bindings). Creating
  or changing users answers 403.

## Consequences

- One process holds the key and refresh tokens, so the API cannot be replicated in this
  mode.
- No user accounts besides the admin. An app owner other than the admin, self-registration
  and app logins for other users are not available.
- The token endpoint never issues platform-client tokens, so a default platform secret
  cannot be used from outside. A default `ADMIN_PASSWORD` disables the admin login, and
  five failed logins lock a username for five minutes.
- Keycloak mode is unchanged.
