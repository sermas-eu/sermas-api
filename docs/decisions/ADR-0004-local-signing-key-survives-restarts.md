# ADR-0004 — The local auth signing key survives a restart

**Date:** 2026-11-22
**Status:** accepted

## Context

ADR-0002 generated the local auth signing key at start and kept it in memory: "a restart
logs everyone out". In development the API restarts on every rebuild, and each restart
left the kiosk with tokens the API no longer accepted: every call answered 401 until
the kiosk's server dropped its cached token. A deployment restarting for an update
logged out every kiosk the same way.

## Decision

Keep the signing key across restarts. `AUTH_LOCAL_SIGNING_KEY` supplies it as a PEM
private key; without it, the key is generated once and kept in
`AUTH_LOCAL_SIGNING_KEY_FILE` (default: a file in the OS temp directory, owner-readable
only) and read back on the next start. The key id is derived from the key, so it is the
same after a restart. This supersedes the key part of ADR-0002's Tokens decision.

## Consequences

- Access tokens stay valid across a restart until they expire (12 hours). Refresh tokens
  are still in memory and do not survive it.
- The key is a secret at rest. Anyone who can read the file or the env can mint tokens.
- A container's temp directory goes with the container: to keep tokens across a
  re-created container, set `AUTH_LOCAL_SIGNING_KEY` or point the file at a volume.
- To log everyone out, delete the file (or change the env key) and restart.
