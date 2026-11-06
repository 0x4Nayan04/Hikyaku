# ADR-0001: Transactional outbox with immediate enqueue

## Status

Accepted

## Date

2026-11-06

## Context

Ingest must create durable delivery work even when Redis/BullMQ is briefly unavailable. Losing a committed delivery after a successful HTTP 202 is unacceptable. Blocking ingest until the queue acknowledges every job would couple API availability to Redis.

## Decision

In the same Postgres transaction as the event and delivery rows, write a `delivery_outbox` row. After commit, enqueue the BullMQ job immediately and delete the outbox row only when enqueue succeeds. If enqueue fails or times out, leave the row for the worker sweeper to recover.

## Alternatives considered

### Enqueue only (no outbox)

- Pros: fewer tables and paths.
- Cons: a Redis outage after commit drops work with no recovery record.
- Rejected: silent loss after accept.

### Outbox only (no immediate enqueue)

- Pros: simpler happy path for the API process.
- Cons: every delivery waits for the sweeper interval even when Redis is healthy.
- Rejected: adds latency when the queue is available.

## Consequences

- API and sweeper both know how to publish and acknowledge outbox rows; keep those paths aligned.
- Callers can see `503` on ingest when enqueue fails while the outbox still protects the delivery.
- Operators must run the worker sweeper in every environment that accepts events.
