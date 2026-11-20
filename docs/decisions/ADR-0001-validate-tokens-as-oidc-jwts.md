# ADR-0001 — Validate access tokens as plain OIDC JWTs; keep Keycloak permission evaluation

**Date:** 2026-11-20
**Status:** accepted

## Context

The API authenticated requests with `nest-keycloak-connect`, a wrapper around Keycloak's
Node adapter `keycloak-connect`. Keycloak has deprecated that adapter, and the wrapper
declares NestJS `<11` as its peer, so it blocks every NestJS upgrade.

Of what the wrapper provided, the API used three parts:

- `AuthGuard`, which validates the token offline: signature, expiry, issuer.
- `RoleGuard` with `@Roles`, for one admin realm role.
- `@Resource`, `@Scopes`, `@Public` and `@AuthenticatedUser` as metadata and a parameter
  decorator.

Its `ResourceGuard` (Keycloak policy enforcement) was disabled. Authorization is done by
the API's own `PlatformGuard`, which asks Keycloak to evaluate the client's permission for
the controller's resource and the route's scopes.

The adapter accepted only one issuer, derived from `AUTH_KEYCLOAK_URL`. That forced the
realm's frontend URL to equal the API's backchannel URL.

## Decision

Validate tokens with standard JWT verification in `libs/auth`:

- Verify the signature against the realm's JWKS, fetched from `AUTH_KEYCLOAK_URL`, cached,
  and refetched at most every 30 seconds when an unknown key id appears.
- Check expiry and an issuer from `AUTH_KEYCLOAK_ISSUERS`, a comma-separated list. It
  defaults to the realm URL under `AUTH_KEYCLOAK_FRONTEND_URL`, or under
  `AUTH_KEYCLOAK_URL` when no frontend URL is set.
- Read the token from the `Authorization: Bearer` header, or from the `KEYCLOAK_JWT`
  cookie.
- Provide the same decorators under the same names (`Public`, `Resource`, `Scopes`,
  `Roles`, `AuthenticatedUser`), a `JwtAuthGuard` and a `RoleGuard`.

Keep `PlatformGuard` and its Keycloak permission evaluation unchanged.

Use `jsonwebtoken` with Node's `crypto.createPublicKey` for JWKs. Do not use `jose` 6 or
`jwks-rsa` 4: both are ESM-only internally, and the CommonJS test runtime cannot load
them.

## Consequences

- NestJS can be upgraded. No Keycloak-specific adapter remains in the request path.
- The issuer is configuration, not a side effect of the backchannel URL: a deployment
  can serve browsers on one hostname while the API reaches Keycloak on another.
- Token validation is code we own, and its tests (`libs/auth/auth.spec.ts`) are the guard
  against regressions: issuer, signature, expiry, `alg: none`, and public routes.
- Authorization still depends on Keycloak Authorization Services through the admin API
  on every protected request. Moving that evaluation into the token (scopes or roles
  claims) would be a separate decision.
- Online token introspection, which keycloak-connect could do, is not available. A
  token revoked in Keycloak stays valid until it expires.
