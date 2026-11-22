# ADR-0003 — Local auth is the default; Keycloak is opt-in

**Date:** 2026-11-22
**Status:** accepted

## Context

ADR-0002 added `AUTH_PROVIDER=local` and kept Keycloak the default. In practice SERMAS is
run as a single instance showing one app: the dev stack, the demo deployment and the
v2 getting-started all use local auth. Under the old default, every one of them had to
opt out of Keycloak, and Keycloak (with its database) was started and secured for nothing.

## Decision

Make `local` the default `AUTH_PROVIDER`. `keycloak` is chosen explicitly; any other value
stops the API at start. The local provider is unchanged (ADR-0002). This supersedes only
ADR-0002's "the default stays keycloak".

The surrounding defaults follow: the node SDK's `PUBLIC_AUTH_URL` and the kiosk's point
at the API's `/api/auth/oidc`, and the dev stack starts Keycloak only with its compose
profile `keycloak`.

## Consequences

- A deployment that relies on Keycloak must now set `AUTH_PROVIDER=keycloak` (and
  `PUBLIC_AUTH_URL` to Keycloak in the kiosk). Without it, the API starts in local mode
  and its tokens are not Keycloak's.
- Out of the box there is no admin login: `ADMIN_PASSWORD` defaults to `admin`, which
  local mode refuses. Set it to import apps or use the CLI.
- Multi-user setups, app owners other than the admin and replicas of the API still need
  Keycloak.
