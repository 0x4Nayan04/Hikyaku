# Deploy & ops — Hikyaku

Local app development uses **Node.js 22** (`nvm use` / root `.nvmrc`, then `pnpm dev` + root `docker-compose.yml`).  
This folder is for **production-style** hosting and longer reference notes moved out of the root README.

---

## Main path: Docker Compose (recommended)

One VPS running API + worker + Postgres + Redis + Caddy-served web. Cookies stay on one host.

Requires Docker Engine with Compose v2 and **Node.js 22+** for the one-time config command `node deploy/setup.mjs`.

### Start

```sh
node deploy/setup.mjs
docker compose --env-file .env.production -f compose.production.yml up -d --build
```

Open https://localhost/bootstrap. Find `ADMIN_BOOTSTRAP_SECRET` in your local `.env.production` (do not commit or share it). Create your account and workspace, sign in, add a receiver, send a sample event, and inspect deliveries.

Production receivers must be publicly resolvable HTTPS endpoints; private addresses are intentionally blocked.

### Tuning

Add optional variables to `.env.production`, then apply with:

```sh
docker compose --env-file .env.production -f compose.production.yml up -d
```

| Service | Variables (default) |
| --- | --- |
| API and worker | `DB_POOL_MAX=10`, `LOG_LEVEL=info` |
| API | `SESSION_COOKIE_MAX_AGE=604800000`, `INVITE_TTL_MS=604800000`, `INGEST_RATE_LIMIT_PER_MINUTE=120`, `AUTH_RATE_LIMIT_PER_MINUTE=20`, `TRUST_PROXY=1` |
| Worker | `DELIVERY_TIMEOUT_MS=30000`, `MAX_DELIVERY_ATTEMPTS=5`, `RATE_LIMIT_PER_MINUTE=100`, `WORKER_CONCURRENCY=5`, `SWEEP_INTERVAL_MS=30000` |

`TRUST_PROXY=1` matches the bundled Caddy proxy. Keep it at 1 unless you change the proxy topology. Invalid numeric values stop the affected service at startup.

Caddy issues a local certificate for localhost. Export its root certificate:

```sh
docker compose --env-file .env.production -f compose.production.yml cp web:/data/caddy/pki/authorities/local/root.crt ./hikyaku-local-root.crt
```

Trust this certificate in your OS/browser store, then reload. For a public domain, set `SITE_ADDRESS` (no scheme or path), point DNS at the machine, allow 80/443, and rerun startup. Only Caddy publishes ports; API, PostgreSQL, and Redis stay on the Compose network.

### Operate

```sh
docker compose --env-file .env.production -f compose.production.yml ps -a
docker compose --env-file .env.production -f compose.production.yml logs --tail=100 api worker migrate
docker compose --env-file .env.production -f compose.production.yml down
```

`down` preserves volumes. Do not add `-v` unless intentionally deleting this installation. `/v1/ready` checks PostgreSQL/Redis, not delivery execution — confirm a real delivery after install or upgrade.

Optional: set `BUILD_REVISION` or `GIT_SHA` on the API and worker services to expose the running release in `/v1/health` and `/v1/ready` (for example your image tag or deploy commit).

### Backup and upgrade

```sh
docker compose --env-file .env.production -f compose.production.yml stop api worker
docker compose --env-file .env.production -f compose.production.yml exec -T postgres pg_dump -U webhook -d webhooks -Fc > hikyaku-backup.dump
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml up -d
```

Keep the backup, previous application revision, and `.env.production` securely. Do not restart application services if migration fails. Never roll old code onto an incompatible new schema.

---

## Optional: Vercel + Railway

Split hosting is **optional**. Prefer Compose above unless you specifically want a separate frontend host.

- Web on **Vercel**, API + worker on **Railway**
- `vercel.json` proxies browser `/v1` to Railway so the session cookie stays on the Vercel origin
- On Vercel: `API_UPSTREAM_URL` = public Railway API origin, `PROXY_IP_SECRET` (≥16 chars), `ENABLE_EXPERIMENTAL_COREPACK=1`; leave `VITE_API_URL` unset
- On Railway API: same `PROXY_IP_SECRET`, `CORS_ORIGIN` + `WEB_APP_URL` = Vercel origin, `TRUST_PROXY=1`
- Set `VITE_PUBLIC_API_URL` to the Railway origin on the Vercel build for docs/curl samples
- Pre-deploy: `node apps/api/dist/scripts/migrate.js`
- Build/start from **repo root** with `pnpm --filter @hikyaku/api...` / `@hikyaku/worker` — do not set root directory to `apps/api` or `apps/worker`
- Worker: no public domain / healthcheck; API healthcheck → `/v1/ready`
- Vercel preview URLs are separate origins; add them to `CORS_ORIGIN` if needed

---

## Reference (from root README)

### Health checks

```bash
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/ready
```

`/v1/health` — process up. `/v1/ready` — Postgres and Redis reachable.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres |
| `DB_POOL_MAX` | Max PostgreSQL connections per process |
| `REDIS_URL` | Redis / BullMQ |
| `ADMIN_BOOTSTRAP_SECRET` | One-time super-admin bootstrap |
| `SESSION_SECRET` | Session cookie signing (min 32 chars) |
| `SESSION_COOKIE_MAX_AGE` | Session cookie lifetime (ms) |
| `WEB_APP_URL` | Invite link base URL |
| `INVITE_TTL_MS` | Invite link expiry (default 7 days) |
| `CORS_ORIGIN` | Allowed browser origins |
| `TRUST_PROXY` | Proxy hops for `X-Forwarded-*`. Local default `0`; production requires an explicit value |
| `INGEST_RATE_LIMIT_PER_MINUTE` | Max `POST /v1/events` per tenant/minute |
| `AUTH_RATE_LIMIT_PER_MINUTE` | Auth attempts per IP/minute |
| `LOG_LEVEL` | Log verbosity |
| `VITE_API_URL` | API base for the web app (build-time). Empty on Vercel so the browser uses same-origin `/v1` |
| `VITE_PUBLIC_API_URL` | Public API origin for docs/curl samples |
| `PROXY_IP_SECRET` | Shared secret for the Vercel `/v1` proxy. Omit on single-host Compose |

See root `.env.example` for local worker tuning. `TRUST_PROXY=1` means one trusted reverse-proxy hop.

### Delivery guarantees (summary)

- **At-least-once** delivery with retries; subscribers should dedupe on `X-Webhook-Id`
- **Transactional outbox** so committed deliveries are not lost if Redis is down at ingest
- **Lease + sweeper** recovers crashed `in_progress` work without granting an extra attempt incorrectly
- **Idempotent enqueue** per live queue job; HTTP delivery remains at-least-once
- **Per-tenant rate limits** on outbound admissions
- **Signed + timestamped** bodies (`X-Webhook-Signature`, `X-Webhook-Timestamp`; reject skew over 5 minutes)
- **Replay** for failed deliveries from console or API

Full product docs after `pnpm dev`: http://localhost:5173/docs

### Useful scripts (repo root)

| Command | Description |
| --- | --- |
| `pnpm dev` | API + worker + web |
| `pnpm build` / `pnpm typecheck` / `pnpm lint` | Build and checks |
| `pnpm test` | Unit + integration |
| `pnpm test:smoke` | Playwright smoke |
| `pnpm docker:up` / `pnpm docker:down` | Local Postgres + Redis |
| `pnpm db:migrate` / `pnpm db:seed` | Migrate / local seed |

### Safe tests

Use `.env.test.example` for `TEST_DATABASE_URL`, `TEST_REDIS_URL`, and a fresh `TEST_RUN_ID`. Tests never load the development `.env`. Use a separate Postgres DB ending in `_test` and a separate Redis DB number.

```sh
pnpm --filter @hikyaku/shared build
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate
pnpm test
pnpm test:smoke
```

Browser tests start their own API (3101) and web (5181). They never truncate unrelated databases; cleanup removes only run-owned fixtures.
