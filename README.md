# Webhook Delivery

Multi-tenant webhook delivery platform with async job queues, signed outbound HTTP deliveries, retries, per-tenant rate limiting, and an operator console.

**Documentation:** [http://localhost:5173/docs](http://localhost:5173/docs) (after `pnpm dev`) · **Dashboard guide:** [docs/dashboard-guide.md](docs/dashboard-guide.md)

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
| Docs          | http://localhost:5173/docs           |
| Worker        | background process (BullMQ consumer) |

Run services individually:

```bash
pnpm --filter @webhook/api dev
pnpm --filter @webhook/worker dev
pnpm --filter @webhook/web dev
```

## First-time setup

Pick one path to create your first operator account.

### Option A — Bootstrap (recommended for local UI)

1. Open http://localhost:5173/bootstrap
2. Enter the `ADMIN_BOOTSTRAP_SECRET` from `.env`
3. Create the super-admin account → sign in at `/login`
4. On **Admin**, approve a signup at `/signup` or **Invite tenant**
5. Sign in as the tenant owner → land on **Dashboard** (`/dashboard`)

### Option B — Dev seed (API-only smoke tests)

Seeds demo tenants with API keys (and optionally a super-admin via env):

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

| Page            | Route              | Who                    |
| --------------- | ------------------ | ---------------------- |
| Landing         | `/`                | Public                 |
| Docs            | `/docs`            | Public                 |
| Login / Signup  | `/login`, `/signup`| Public                 |
| Bootstrap       | `/bootstrap`       | First deploy only      |
| Accept invite   | `/accept-invite`   | Invite recipients      |
| Dashboard       | `/dashboard`       | Tenant users           |
| Endpoints       | `/endpoints`       | Tenant users           |
| Events          | `/events`          | Tenant users           |
| Send event      | `/events/send`     | Tenant users           |
| Deliveries      | `/deliveries`      | Tenant users (live SSE)|
| Settings        | `/settings`        | Tenant users           |
| Admin           | `/admin`           | Super-admin only       |
| Tenant admin    | `/admin/tenants/:id` | Super-admin only     |

**Roles:** Super-admins manage tenants (approve signups, invite owners, audit log). Tenant users manage endpoints, events, deliveries, and API keys. Super-admins are not tenant-scoped and cannot open tenant dashboard pages.

See [docs/dashboard-guide.md](docs/dashboard-guide.md) for a full browser walkthrough.

## Health checks

```bash
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/ready
```

`/v1/health` confirms the API process is running. `/v1/ready` checks Postgres and Redis connectivity.

## Authentication

Two auth modes resolve to the same tenant scope for tenant users:

| Mode              | Use case                          | How                                      |
| ----------------- | --------------------------------- | ---------------------------------------- |
| **API key**       | Scripts, backends, `curl`         | `Authorization: Bearer whk_...`        |
| **Session cookie**| Browser console (Send Event, etc.)| Login at `/login` → httpOnly session     |

API keys are created in **Settings → API keys** (or via `POST /v1/api-keys`). Keys are shown once on create/rotate; only a SHA-256 hash is stored server-side.

## Events API

Ingest events with a tenant API key or session cookie. Returns `202 Accepted`.

```bash
curl -X POST http://localhost:3000/v1/events \
  -H "Authorization: Bearer whk_..." \
  -H "Content-Type: application/json" \
  -d '{"idempotency_key":"order-123","type":"order.created","payload":{"order_id":"ord_123"}}'
```

| Field             | Rules                                      |
| ----------------- | ------------------------------------------ |
| `idempotency_key` | Required, unique per tenant                |
| `type`            | Required event type string                 |
| `payload`         | Required JSON object                       |

Duplicate `idempotency_key` returns the existing event with `202` — no duplicate fan-out.

List and inspect events: `GET /v1/events`, `GET /v1/events/:id`.

## Endpoints API

Subscriber endpoints are scoped to the tenant resolved from your API key or session.

### Create an endpoint

Returns `201` with the signing secret **once**. Store `secret` immediately — list and update responses never include it.

```bash
curl -X POST http://localhost:3000/v1/endpoints \
  -H "Authorization: Bearer whk_..." \
  -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/test","description":"test"}'
```

| Field         | Rules                                    |
| ------------- | ---------------------------------------- |
| `url`         | Required, valid URL, max 2048 characters |
| `description` | Optional, max 512 characters             |

### List endpoints

Paginated with `?limit=` (1–100, default 50) and `?offset=` (default 0). The `secret` field is never returned.

### Disable an endpoint

Only `status` and `description` can change. `url` and `secret` are immutable (`400 immutable_field`).

```bash
curl -X PATCH "http://localhost:3000/v1/endpoints/<id>" \
  -H "Authorization: Bearer whk_..." \
  -H "Content-Type: application/json" \
  -d '{"status":"disabled"}'
```

Cross-tenant access by endpoint id returns `404 not_found`.

## Deliveries API

| Route                          | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `GET /v1/deliveries`           | Paginated delivery log (`?status=` filter)   |
| `GET /v1/deliveries/:id`       | Delivery detail + attempt timeline           |
| `POST /v1/deliveries/:id/replay` | Re-queue a **failed** delivery (`202`)     |
| `GET /v1/deliveries/stream`    | SSE live updates (session cookie only)       |

Outbound POST body shape: `{ id, type, created_at, data }` where `data` is your ingested payload.

Headers: `Content-Type`, `X-Webhook-Id`, `X-Webhook-Timestamp`, `X-Webhook-Signature` (`sha256=<hex>`), `User-Agent: WebhookDelivery/1.0`.

## API keys

| Route                            | Purpose                    |
| -------------------------------- | -------------------------- |
| `GET /v1/api-keys`               | List keys (prefix only)    |
| `POST /v1/api-keys`              | Create key (shown once)    |
| `POST /v1/api-keys/:id/revoke`   | Revoke a key               |
| `POST /v1/api-keys/:id/rotate`   | Rotate (new key shown once)|

## Retries and rate limits

| Setting          | Value                                              |
| ---------------- | -------------------------------------------------- |
| Max attempts     | 5 per delivery                                     |
| Backoff          | Exponential + jitter (~1m → 2m → 4m → 8m, cap 1h) |
| Success          | HTTP 2xx within 30s                                |
| Retryable        | Network error, timeout, 408, 429, 5xx              |
| Fail-fast        | 4xx (except 408, 429)                              |
| Rate limit       | 100 HTTP delivery attempts / minute / tenant       |

Rate-limited jobs defer for 60s without counting toward the 5-attempt cap.

## Manual smoke test (webhook.site)

Use [webhook.site](https://webhook.site) to confirm signed deliveries end-to-end. Requires API, worker, and a tenant API key (`pnpm db:seed` or create one in Settings).

1. Open webhook.site and copy your unique URL.
2. Create an endpoint with that URL. Save the `secret` from the response.
3. Ingest an event:

```bash
curl -X POST http://localhost:3000/v1/events \
  -H "Authorization: Bearer whk_..." \
  -H "Content-Type: application/json" \
  -d '{"idempotency_key":"smoke-1","type":"order.created","payload":{"order_id":"ord_123"}}'
```

4. On webhook.site, confirm within a few seconds:
   - **Body:** `{ "id", "type", "created_at", "data" }`
   - **Headers:** signature, delivery id, timestamp
5. Verify the signature (HMAC-SHA256 over `` `${timestamp}.${rawBody}` ``):

```bash
node --input-type=module -e "
import { verifyPayload } from '@webhook/shared/crypto';
const secret = 'whsec_...';
const timestamp = 1717654321;
const rawBody = '{\"id\":\"...\",\"type\":\"order.created\",\"created_at\":\"...\",\"data\":{\"order_id\":\"ord_123\"}}';
const signature = 'sha256=...';
console.log(verifyPayload(secret, timestamp, rawBody, signature));
"
```

Expected: `true`.

## Environment variables

Key settings in `.env`:

| Variable                  | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `DATABASE_URL`            | Postgres connection                          |
| `REDIS_URL`               | Redis / BullMQ                               |
| `ADMIN_BOOTSTRAP_SECRET`  | One-time super-admin bootstrap               |
| `SESSION_SECRET`          | Session cookie signing (min 32 chars)        |
| `WEB_APP_URL`             | Invite link base URL                         |
| `CORS_ORIGIN`             | Allowed browser origins                      |
| `VITE_API_URL`            | API base URL for the web app (build-time)    |

See `.env.example` for worker tuning (`DELIVERY_TIMEOUT_MS`, `MAX_DELIVERY_ATTEMPTS`, `RATE_LIMIT_PER_MINUTE`, etc.).

## Scripts

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `pnpm dev`              | Start API, worker, and web concurrently |
| `pnpm build`            | Build all packages                      |
| `pnpm typecheck`        | TypeScript project references build     |
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
apps/api       REST API (Express) — auth, ingest, deliveries, admin
apps/worker    Delivery worker (BullMQ)
apps/web       Operator dashboard + docs (Vite + React)
packages/shared  Shared types, schema, env parsing, crypto
docs/          Dashboard guide, PRD
e2e/           Playwright smoke and visual tests
```
