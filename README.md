# Webhook Delivery

Multi-tenant webhook delivery platform with async job queues, signed outbound HTTP deliveries, retries, and per-tenant rate limiting.

## Prerequisites

- Node.js 20 (`nvm use`)
- [pnpm](https://pnpm.io/)
- Docker (Postgres 16 + Redis 7 for local development)

## Local development

```bash
git clone <repo-url>
cd webhook-delivery
cp .env.example .env
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm dev
```

This starts:

| Service       | URL                                  |
| ------------- | ------------------------------------ |
| API           | http://localhost:3000                |
| Web dashboard | http://localhost:5173                |
| Worker        | background process (BullMQ consumer) |

Run services individually:

```bash
pnpm --filter @webhook/api dev
pnpm --filter @webhook/worker dev
pnpm --filter @webhook/web dev
```

## Health checks

```bash
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/ready
```

`/v1/health` confirms the API process is running. `/v1/ready` checks Postgres and Redis connectivity.

## Endpoints API

Subscriber endpoints are scoped to the tenant resolved from your API key. All routes require `Authorization: Bearer <api_key>`.

Get a key from the seed script:

```bash
pnpm db:seed
# Copy one of the printed API keys (whk_...)
```

### Create an endpoint

Returns `201` with the signing secret **once**. Store `secret` immediately — list and update responses never include it.

```bash
curl -X POST http://localhost:3000/v1/endpoints \
  -H "Authorization: Bearer whk_..." \
  -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/test","description":"test"}'
```

Example response:

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "url": "https://webhook.site/test",
  "secret": "whsec_f1e2d3c4b5a6978012345678abcdef02",
  "status": "active",
  "description": "test",
  "created_at": "2026-06-05T12:00:00.000Z"
}
```

| Field         | Rules                                    |
| ------------- | ---------------------------------------- |
| `url`         | Required, valid URL, max 2048 characters |
| `description` | Optional, max 512 characters             |

### List endpoints

Paginated with `?limit=` (1–100, default 50) and `?offset=` (default 0). The `secret` field is never returned.

```bash
curl http://localhost:3000/v1/endpoints \
  -H "Authorization: Bearer whk_..."
```

### Disable an endpoint

Only `status` and `description` can change. `url` and `secret` are immutable (`400 immutable_field`).

```bash
curl -X PATCH "http://localhost:3000/v1/endpoints/<id>" \
  -H "Authorization: Bearer whk_..." \
  -H "Content-Type: application/json" \
  -d '{"status":"disabled"}'
```

Cross-tenant access by endpoint id returns `404 not_found`.

## Manual smoke test (webhook.site)

Use [webhook.site](https://webhook.site) to confirm signed deliveries end-to-end with a real HTTP subscriber. Requires the API and worker running (`pnpm dev` or both processes started separately).

1. Open webhook.site and copy your unique URL (`https://webhook.site/<uuid>`).
2. Seed a tenant and copy an API key:

```bash
pnpm db:seed
```

3. Create an endpoint with that URL. Save the `secret` from the response — it is shown only once.

```bash
curl -X POST http://localhost:3000/v1/endpoints \
  -H "Authorization: Bearer whk_..." \
  -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/<your-uuid>","description":"smoke test"}'
```

4. Ingest an event:

```bash
curl -X POST http://localhost:3000/v1/events \
  -H "Authorization: Bearer whk_..." \
  -H "Content-Type: application/json" \
  -d '{"idempotency_key":"smoke-1","type":"order.created","payload":{"order_id":"ord_123"}}'
```

5. On webhook.site, confirm the request within a few seconds:
   - **Body:** `{ "id", "type", "created_at", "data" }` where `id` is the event UUID and `data` matches your payload.
   - **Headers:** `Content-Type: application/json`, `X-Webhook-Id` (delivery UUID), `X-Webhook-Timestamp` (Unix seconds), `X-Webhook-Signature` (`sha256=<hex>`), `User-Agent: WebhookDelivery/1.0`.
6. Verify the signature using the endpoint secret and the **raw request body** (exact bytes, before JSON parsing):

```bash
node --input-type=module -e "
import { verifyPayload } from '@webhook/shared/crypto';
const secret = 'whsec_...'; // from step 3
const timestamp = 1717654321; // from X-Webhook-Timestamp
const rawBody = '{\"id\":\"...\",\"type\":\"order.created\",\"created_at\":\"...\",\"data\":{\"order_id\":\"ord_123\"}}'; // copy from webhook.site
const signature = 'sha256=...'; // from X-Webhook-Signature
console.log(verifyPayload(secret, timestamp, rawBody, signature));
"
```

Expected: `true`.

7. Disable the endpoint, ingest another event, and confirm the delivery fails with `endpoint_disabled` (no new request on webhook.site):

```bash
curl -X PATCH "http://localhost:3000/v1/endpoints/<id>" \
  -H "Authorization: Bearer whk_..." \
  -H "Content-Type: application/json" \
  -d '{"status":"disabled"}'

curl -X POST http://localhost:3000/v1/events \
  -H "Authorization: Bearer whk_..." \
  -H "Content-Type: application/json" \
  -d '{"idempotency_key":"smoke-2","type":"order.created","payload":{"order_id":"ord_456"}}'
```

The signing algorithm is HMAC-SHA256 over `` `${timestamp}.${rawBody}` `` using the endpoint secret as the key.

## Delivery failure modes

When the worker delivers an event to a subscriber URL, outcomes are classified as follows. `attempt_count` on a delivery counts **HTTP POST round-trips only** (not audit-only short-circuits). Each HTTP attempt is recorded in `delivery_attempts` with an incrementing `attempt_number`.

| Outcome               | Retries?                    | `attempt_count`++ | Delivery status         | Notes                                                           |
| --------------------- | --------------------------- | ----------------- | ----------------------- | --------------------------------------------------------------- |
| HTTP 2xx              | —                           | Yes               | `succeeded`             | Event rolls up to `completed` when all deliveries finish        |
| Network error         | Yes (up to 5 HTTP attempts) | Yes               | `pending` between tries | BullMQ exponential backoff; see schedule below                  |
| Timeout (30s)         | Yes                         | Yes               | `pending` between tries | Recorded as `timeout` in `delivery_attempts.error`              |
| HTTP 408, 429, 5xx    | Yes                         | Yes               | `pending` between tries | Subscriber may recover; worker rethrows for BullMQ backoff      |
| HTTP 4xx (other)      | No                          | Yes               | `failed`                | Fail-fast — no further attempts (e.g. `400`, `404`)             |
| Endpoint disabled     | No                          | No                | `failed`                | No HTTP call; `last_error=endpoint_disabled`                    |
| Max HTTP attempts (5) | No                          | No\*              | `failed`                | Dead letter; `last_error=max_attempts`; worker does not rethrow |
| Rate limit exceeded   | Yes (after ~60s defer)      | No                | `deferred`              | No HTTP call; `delivery_attempts.error=rate_limited`            |

\*Short-circuit paths record a `delivery_attempt` row with an `error` but do not increment `attempt_count`.

### Retry backoff

BullMQ uses exponential backoff with a 60-second base (approximately 2× per failed attempt). The worker sets `next_retry_at` on the delivery row for operator visibility.

| HTTP attempt # | Approximate delay before next try |
| -------------- | --------------------------------- |
| 1 (first try)  | Immediate                         |
| 2              | ~60s                              |
| 3              | ~120s                             |
| 4              | ~240s                             |
| 5              | ~480s (dead letter if this fails) |

While a delivery is actively posting, its status is `in_progress`. Between retryable failures it returns to `pending` until the next attempt.

### Per-tenant rate limiting

The worker enforces a **token bucket** in Redis before each outbound HTTP POST. The limit applies to **delivery HTTP attempts per tenant**, not event ingest — bursts of events are accepted and shaped at dispatch time.

| Setting           | Default | Env var                 |
| ----------------- | ------- | ----------------------- |
| Capacity / refill | 100/min | `RATE_LIMIT_PER_MINUTE` |
| Defer duration    | 60s     | (fixed in v1)           |
| Redis key         | —       | `ratelimit:tenant:<id>` |

When the bucket is empty, the worker records a `delivery_attempt` with `error=rate_limited`, sets the delivery to `deferred` with `next_retry_at` about 60 seconds ahead, and reschedules the BullMQ job — **without** incrementing `attempt_count` and **without** counting toward the five HTTP retry cap.

| Aspect               | Rate-limit defer | HTTP retry                  |
| -------------------- | ---------------- | --------------------------- |
| HTTP attempted?      | No               | Yes                         |
| `attempt_count`++    | No               | Yes                         |
| BullMQ behavior      | Job delayed ~60s | Throw + exponential backoff |
| Status while waiting | `deferred`       | `pending`                   |

The bucket is shared across all worker replicas for a tenant. Tokens refill continuously (100 per minute). A burst of up to the configured limit is allowed; additional jobs wait until tokens are available. Events stay `pending` while any delivery is `deferred`.

Configure the cap in `.env`:

```bash
RATE_LIMIT_PER_MINUTE=100
```

### Manual checks

- **Transient failure:** Point an endpoint at a local mock that returns `503` three times then `200`. Expect four `delivery_attempts` rows and a final `succeeded` delivery.
- **Fail-fast:** Return `400` on the first request. Expect one attempt and `failed` with no further retries.
- **Rate limit:** Ingest more than `RATE_LIMIT_PER_MINUTE` events rapidly for one tenant. Expect the first N deliveries to reach subscribers (HTTP attempted) and the remainder to show `deferred` with `rate_limited` in the attempt log and unchanged `attempt_count`. After the bucket refills (~60s), deferred jobs should deliver.

## Testing

### Prerequisites

Integration tests use the same Postgres and Redis as local development:

```bash
pnpm docker:up
pnpm db:migrate
```

Set `DATABASE_URL` and `REDIS_URL` in `.env` (see `.env.example`). Do not run integration tests against production.

### Commands

| Command                 | Scope                                              |
| ----------------------- | -------------------------------------------------- |
| `pnpm test`             | Unit tests, then integration tests                 |
| `pnpm test:unit`        | All packages (`apps/api`, `apps/worker`, `shared`)  |
| `pnpm test:integration` | API integration tests, then worker integration |

CI (`.github/workflows/ci.yml`) runs `lint` → `typecheck` → `test:unit` → `db:migrate` → `test:integration` with Postgres 16 and Redis 7 service containers.

### Layout

```
apps/api/test/
  helpers/tenant.ts          # createTenantWithKey, deleteTenant
  unit/                      # validation, auth, pagination (no Docker)
  integration/               # Supertest against Express app + real DB/Redis

apps/worker/test/
  unit/                      # processor, rate limit, backoff, status, sweeper
  integration/               # mock HTTP servers + real DB/Redis + processor

packages/shared/test/unit/   # crypto, env parsing
```

**API integration** (`apps/api/test/integration/`): health, auth, endpoints, events, deliveries, stats, pagination, tenant isolation.

**Worker integration** (`apps/worker/test/integration/`): retry, rate-limit, e2e pipeline. Worker tests import the API app for ingest and use `processor` directly or a short-lived BullMQ `Worker` where needed.

Each integration file manages its own setup/teardown (tenant seeding, queue obliterate, pool/redis close). There is no shared global setup file.

### Priority integration tests (release gate)

These five behaviors must pass in CI before merge to `main`:

| # | Behavior              | File                                              |
| - | --------------------- | ------------------------------------------------- |
| 1 | Ingest idempotency    | `apps/api/test/integration/events.test.ts`        |
| 2 | Transient failure retry | `apps/worker/test/integration/retry.test.ts`    |
| 3 | Fail-fast (HTTP 4xx)  | `apps/worker/test/integration/retry.test.ts`      |
| 4 | Tenant isolation      | `apps/api/test/integration/tenant-isolation.test.ts` |
| 5 | E2E pipeline + HMAC   | `apps/worker/test/integration/e2e-pipeline.test.ts` |

Additional integration coverage includes endpoint tenant checks (`endpoints-tenant.test.ts`) and rate limiting (`rate-limit.test.ts`).

## Scripts

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `pnpm dev`              | Start API, worker, and web concurrently |
| `pnpm build`            | Build all packages                      |
| `pnpm typecheck`        | TypeScript project references build     |
| `pnpm lint`             | ESLint                                  |
| `pnpm test`             | Unit + integration tests                |
| `pnpm test:unit`        | Unit tests only (all packages)          |
| `pnpm test:integration` | API and worker integration tests        |
| `pnpm docker:up`        | Start Postgres and Redis                |
| `pnpm docker:down`      | Stop Docker services                    |
| `pnpm db:migrate`       | Apply database migrations               |
| `pnpm db:seed`          | Seed demo data                          |

## Project layout

```
apps/api      REST API (Express)
apps/worker   Delivery worker (BullMQ)
apps/web      Operator dashboard (Vite + React)
packages/shared  Shared types, env parsing, constants
```
