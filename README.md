# Hikyaku

<p align="center">
  <img src="apps/web/public/logo/hikyaku-lockup.png" alt="Hikyaku" width="420" />
</p>

Self-hosted, multi-tenant webhook delivery. Ingest an event once; the worker fans it out as HMAC-SHA256-signed HTTP POSTs, retries transient failures with exponential backoff, and keeps attempt history in an operator console.

**Name:** 飛脚 (*hikyaku*) — Japan’s historic express couriers.

**Stack:** Node.js, Express, BullMQ, Postgres, Redis, Vite/React.

**Repo:** [github.com/0x4Nayan04/Hikyaku](https://github.com/0x4Nayan04/Hikyaku) · **License:** [MIT](./LICENSE)

**Product docs (after `pnpm dev`):** http://localhost:5173/docs

## Demo

No hosted demo yet — run it locally (below). After `pnpm dev`:

| Surface | URL |
| ------- | --- |
| Landing | http://localhost:5173 |
| Docs | http://localhost:5173/docs |
| Console | http://localhost:5173/login |

Bootstrap once at `/bootstrap`, invite a tenant owner from **Admin**, then use the tenant console.

## Architecture

```
Producer ──POST /v1/events──► API ──enqueue──► Redis (BullMQ)
                                                │
                                                ▼
                                         Worker (fan-out)
                                                │
                         ┌──────────────────────┼──────────────────────┐
                         ▼                      ▼                      ▼
                   Endpoint A             Endpoint B             Endpoint C
                (HMAC-SHA256 POST)     (retry / backoff)      (attempt logs)
                                                │
                                                ▼
                                         Postgres + console
                                    (events, deliveries, polling)
```

| Piece | Role |
| ----- | ---- |
| `apps/api` | Auth, ingest, endpoints, deliveries, admin |
| `apps/worker` | Signed outbound HTTP, retries, rate limits |
| `apps/web` | Landing, docs, operator console |
| Postgres | Tenants, events, deliveries, attempt history |
| Redis | BullMQ delivery queue |

## Screenshots

![Deliveries console](apps/web/public/landing/console-deliveries.png)

![Dashboard](apps/web/public/landing/console-dashboard.png)

## Prerequisites

- Node.js 20 (`nvm use`)
- [pnpm](https://pnpm.io/)
- Docker (Postgres 16 + Redis 7 for local development)

## Local development

```bash
git clone https://github.com/0x4Nayan04/Hikyaku.git
cd Hikyaku
cp .env.example .env
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm dev
```

| Service       | URL                                  |
| ------------- | ------------------------------------ |
| API           | http://localhost:3000                |
| Web console   | http://localhost:5173                |
| Docs          | http://localhost:5173/docs           |
| Worker        | background process (BullMQ consumer) |

```bash
pnpm --filter @webhook/api dev
pnpm --filter @webhook/worker dev
pnpm --filter @webhook/web dev
```

## First-time setup

### Option A — Bootstrap (local UI)

1. Open http://localhost:5173/bootstrap
2. Enter `ADMIN_BOOTSTRAP_SECRET` from `.env`
3. Create the super-admin → sign in at `/login`
4. On **Admin**, invite a tenant owner and send them the one-time link
5. Sign in as that tenant → **Dashboard** (`/dashboard`)

### Option B — Dev seed (API smoke tests)

```bash
pnpm db:seed
# Copy one of the printed API keys (whk_...)
```

Optional super-admin seed (only when no users exist):

```bash
# In .env:
# SEED_SUPER_ADMIN_EMAIL=admin@localhost
# SEED_SUPER_ADMIN_PASSWORD=dev-password-min-12-chars
```

## Console overview

| Page            | Route                | Who                      |
| --------------- | -------------------- | ------------------------ |
| Landing         | `/`                  | Public                   |
| Docs            | `/docs`              | Public                   |
| Login           | `/login`             | Public                   |
| Bootstrap       | `/bootstrap`         | First deploy only        |
| Accept invite   | `/accept-invite`     | Invite recipients        |
| Dashboard       | `/dashboard`         | Tenant users             |
| Endpoints       | `/endpoints`         | Tenant users             |
| Events          | `/events`            | Tenant users             |
| Send event      | `/events/send`       | Tenant users             |
| Deliveries      | `/deliveries`        | Tenant users (polling)   |
| Settings        | `/settings`          | Tenant users             |
| Admin           | `/admin`             | Super-admin only         |
| Tenant admin    | `/admin/tenants/:id` | Super-admin only         |

**Roles:** Super-admins invite tenant owners and manage tenants and users. Tenant users manage endpoints, events, deliveries, and API keys. Super-admins are not tenant-scoped and cannot open tenant dashboard pages.

API usage, signing, retries, and the full route table live in the in-app docs: http://localhost:5173/docs

## Health checks

```bash
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/ready
```

`/v1/health` — API process up. `/v1/ready` — Postgres and Redis reachable.

## Manual smoke test (webhook.site)

Needs API, worker, and a tenant API key (`pnpm db:seed` or Settings).

1. Open [webhook.site](https://webhook.site) and copy the URL.
2. Create an endpoint with that URL. Save the `secret`.
3. Ingest an event (see [docs → Quick start](http://localhost:5173/docs#quick-start)).
4. On webhook.site, confirm body `{ id, type, created_at, data }` and signature headers.
5. Verify HMAC as in [docs → Signing](http://localhost:5173/docs#signing).

## Environment variables

| Variable                 | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `DATABASE_URL`           | Postgres                                  |
| `REDIS_URL`              | Redis / BullMQ                            |
| `ADMIN_BOOTSTRAP_SECRET` | One-time super-admin bootstrap            |
| `SESSION_SECRET`         | Session cookie signing (min 32 chars)     |
| `WEB_APP_URL`            | Invite link base URL                      |
| `CORS_ORIGIN`            | Allowed browser origins                   |
| `VITE_API_URL`           | API base URL for the web app (build-time) |

See `.env.example` for worker tuning (`DELIVERY_TIMEOUT_MS`, `MAX_DELIVERY_ATTEMPTS`, `RATE_LIMIT_PER_MINUTE`, etc.).

## Scripts

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `pnpm dev`              | Start API, worker, and web concurrently |
| `pnpm build`            | Build all packages                      |
| `pnpm typecheck`        | TypeScript check (api, worker, web, shared) |
| `pnpm lint`             | ESLint                                  |
| `pnpm format`           | Prettier                                |
| `pnpm test`             | Unit + integration tests                |
| `pnpm test:integration` | API and worker integration tests        |
| `pnpm test:smoke`       | Playwright smoke / visual tests         |
| `pnpm docker:up`        | Start Postgres and Redis                |
| `pnpm docker:down`      | Stop Docker services                    |
| `pnpm db:migrate`       | Apply database migrations               |
| `pnpm db:seed`          | Seed demo tenants + API keys            |
| `pnpm db:generate`      | Generate Drizzle migrations             |

## Project layout

```
apps/api         REST API (Express) — auth, ingest, deliveries, admin
apps/worker      Delivery worker (BullMQ)
apps/web         Operator console + docs (Vite + React)
packages/shared  Shared types, schema, env parsing, crypto
e2e/             Playwright smoke and visual tests
```
