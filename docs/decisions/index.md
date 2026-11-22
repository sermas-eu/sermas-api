# Decisions

Architecture decision records: **why a technical choice was made here**, when the reason
is not derivable from the code and would otherwise be re-litigated.

One file per decision, named `ADR-####-short-slug.md`, with this shape:

```markdown
# ADR-0001 — <the decision, as a statement>

**Date:** <ISO-8601>
**Status:** accepted | superseded by ADR-####

## Context
<what forced a choice. The constraint, and what had already been tried.>

## Decision
<what was decided, in the imperative.>

## Consequences
<what this costs, what it forecloses, and what will tempt someone to undo it.>
```

## What is not an ADR

- **A requirement.** What the product must do belongs with the requirements, where it can
  be traced to a test. An ADR is measured by nothing.
- **A rule with a referent that something already measures.** If a statement could carry
  an identifier and a test that names it, put it where that measurement happens. Deciding
  it here hides it from the report.
- **A procedure.** That is `.agents/playbooks/`.
- **A fact about the code.** That is `.agents/knowledge/`.

An ADR is immutable once accepted. It is superseded by a later ADR that names it, never
edited to say something else.

## The records

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](ADR-0001-validate-tokens-as-oidc-jwts.md) | Validate access tokens as plain OIDC JWTs; keep Keycloak permission evaluation | accepted |
| [ADR-0002](ADR-0002-local-auth-provider.md) | An optional local auth provider (`AUTH_PROVIDER=local`) for single-instance deployments | accepted |
