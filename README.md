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
