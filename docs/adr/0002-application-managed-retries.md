# ADR-0002: Application-managed delivery retries

## Status

Accepted

## Date

2026-11-06

## Context

Webhook delivery needs bounded retries with backoff, attempt history in Postgres, and safe recovery when a worker crashes mid-flight. BullMQ can retry failed jobs itself; stacking that on top of delivery-row attempt tracking would double-count attempts or fight lease recovery.

## Decision

BullMQ jobs use `attempts: 1` (`DELIVERY_JOB_OPTIONS`). Retryable HTTP failures schedule the same job later via `moveToDelayed`. The delivery row’s `attempt_count` is capped by `MAX_DELIVERY_ATTEMPTS` (default 5). Subscribers must treat delivery as **at-least-once** and dedupe on `X-Webhook-Id`.

## Alternatives considered

### BullMQ multi-attempt jobs

- Pros: less custom delay code.
- Cons: attempt semantics split between queue and database; harder to align with leases and sweeper recovery.
- Rejected: one owner for retry policy.

### No automatic retries (manual replay only)

- Pros: simplest worker.
- Cons: every transient 503 becomes operator work.
- Rejected: too operationally heavy for the core product promise.

## Consequences

- Retry timing, caps, and crash recovery live in worker/shared code and must stay tested together.
- HTTP delivery remains at-least-once even when enqueue is idempotent per live queue job.
- Replay from console/API remains a separate, explicit path for failed deliveries.
