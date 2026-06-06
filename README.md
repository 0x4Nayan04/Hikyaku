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

## Scripts

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `pnpm dev`              | Start API, worker, and web concurrently |
| `pnpm build`            | Build all packages                      |
| `pnpm typecheck`        | TypeScript project references build     |
| `pnpm lint`             | ESLint                                  |
| `pnpm test`             | Unit + integration tests                |
| `pnpm test:integration` | API integration tests                   |
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
