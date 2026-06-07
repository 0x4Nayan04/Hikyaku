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

## Scripts

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `pnpm dev`              | Start API, worker, and web concurrently |
| `pnpm build`            | Build all packages                      |
| `pnpm typecheck`        | TypeScript project references build     |
| `pnpm lint`             | ESLint                                  |
| `pnpm test`             | Unit + integration tests                |
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
