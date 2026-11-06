# ADR-0003: Split-host public demo vs single-host self-host

## Status

Accepted

## Date

2026-11-06

## Context

The public demo wants a static web front on Vercel and long-running API/worker processes elsewhere. Self-hosters want one Compose stack with cookies on a single origin. Those constraints conflict if one layout is forced on everyone.

## Decision

- **Self-host (supported install):** one-host Docker Compose (API + worker + Postgres + Redis + Caddy). Session cookies stay on that host.
- **Public demo:** web on Vercel, API + worker on Railway; `/v1` is proxied so the session cookie remains on the Vercel origin.

Document both in [deploy/README.md](../../deploy/README.md). Do not treat the split demo as the default self-host recipe.

## Alternatives considered

### Split hosting for everyone

- Pros: matches the public demo topology.
- Cons: harder cookie and proxy setup for typical self-host.
- Rejected as the primary path.

### Compose-only (no split demo)

- Pros: one topology to document.
- Cons: loses the current public demo hosting shape.
- Rejected for the hosted marketing/demo site only.

## Consequences

- Cookie and `PROXY_IP_SECRET` behaviour differ between topologies; check deploy docs before copying env from the demo.
- Rate limiting on the split path depends on the proxy preserving client IPs.
- Engineers debugging “works on demo, fails on Compose” should compare cookie domains and proxy trust first.
