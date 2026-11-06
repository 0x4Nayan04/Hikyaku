# ADR-0004: Operator console uses polling

## Status

Accepted

## Date

2026-11-06

## Context

Operators need list and detail views to update as deliveries move. A push channel (SSE/WebSocket) was explored earlier; the product also needs to work with ordinary HTTP auth, filters, and pagination already used by the REST API.

## Decision

The console refreshes with interval polling (`usePolling`), including optional refresh when a hidden tab becomes visible again. Quiet polls use a non-aborting refresh path so they do not cancel an in-flight load. `GET /v1/deliveries/stream` is not part of the API (returns 404).

## Alternatives considered

### Server-sent events for deliveries

- Pros: fewer idle requests while a page is open.
- Cons: separate auth/streaming surface, harder filter/page semantics, prior client was removed.
- Rejected for the current console.

### Manual refresh only

- Pros: zero background traffic.
- Cons: operators miss in-flight delivery changes.
- Rejected as the default UX.

## Consequences

- Poll intervals and visibility behaviour are part of the product contract and covered by web tests.
- Idle open tabs generate periodic API reads; keep intervals and busy-load guards intentional.
- Adding SSE later would be a new ADR that supersedes this one, not a silent dual path.
