# Developing Hikyaku

First-hour map for engineers who cloned the repo. Product walkthroughs stay in the in-app guide (`pnpm dev` → http://localhost:5173/docs). Ops and self-host detail stay in [deploy/README.md](../deploy/README.md).

## Start here

1. Follow [Local development](../README.md#local-development) in the root README until the landing page and API respond.
2. Bootstrap an installer account ([Demo path](../README.md#demo-path-first-run)).
3. Read the four package roles below, then the ADRs that explain expensive choices.
4. Before changing delivery, auth, or tenancy behaviour, run [TESTING.md](./TESTING.md).

## Package map

| Path | Owns |
| --- | --- |
| `apps/api` | HTTP API: session/API-key auth, ingest, endpoints, deliveries, admin |
| `apps/worker` | BullMQ consumer: signed outbound HTTP, retries, sweeper recovery |
| `apps/web` | Landing, published docs, operator console |
| `packages/shared` | Schema, env parsing, enqueue helpers, webhook URL rules, shared constants |
| `e2e/` | Playwright smoke against a dedicated test stack |
| `deploy/` | Production Compose, backups, Vercel+Railway notes |

## Request path (ingest → delivery)

1. Client calls `POST /v1/events` with an ingest API key (or a session that is allowed to ingest).
2. API writes the event, delivery rows, and outbox rows in one Postgres transaction, then enqueues BullMQ jobs ([ADR-0001](./adr/0001-transactional-outbox.md)).
3. Worker claims a delivery, POSTs a signed body to the endpoint URL, and records the attempt.
4. Retryable failures are delayed by the application, not by BullMQ multi-attempt jobs ([ADR-0002](./adr/0002-application-managed-retries.md)).
5. If enqueue failed after commit, or a worker died mid-flight, the sweeper re-enqueues from outbox / stale leases.

Console lists refresh by polling ([ADR-0004](./adr/0004-console-polling.md)). There is no delivery SSE stream.

## Auth surfaces

- **Ingest API key:** send events only.
- **Session cookie:** console and management APIs; production cookie mutations also need an allowlisted `Origin`.
- **Super-admin session:** `/v1/admin/*` workspace management.

Contract source of truth: [openapi.yaml](./openapi.yaml) (checked against Express routes in API unit tests).

## Docs that are *not* in git

These stay local on developer machines and must not be treated as onboarding:

- Ignored files under `docs/` (for example scratch plans)
- `.project-kb/` (agent/interview knowledge base)

## Related

- Decisions: [docs/adr/](./adr/)
- Tests: [TESTING.md](./TESTING.md)
- Security boundaries: [SECURITY.md](../SECURITY.md)
