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

Open https://localhost/bootstrap. Find `ADMIN_BOOTSTRAP_SECRET` in your local `.env.production` (do not commit or share it). Create your account and workspace, sign in, add a receiver, send a test event, and inspect deliveries.

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

Production Compose uses `postgres:16-alpine` and `redis:7-alpine` images. The API/worker runtime image is the Dockerfile `runtime` stage (`FROM build`), which keeps the pnpm workspace install so `drizzle-orm` / `bullmq` resolve. Keep `runtime` last — Railway builds the last stage.

Set `BUILD_REVISION` (git sha or image tag) in `.env.production` so Compose bakes it into the runtime image and the API/worker env. `/v1/health` and `/v1/ready` then include `revision`. Leave it empty locally if you do not care. On Railway, set `BUILD_REVISION` on the API service or rely on `RAILWAY_GIT_COMMIT_SHA` (GitHub-triggered deploys inject it). Keep the Dockerfile `runtime` stage last — Railway builds the last stage by default.

After first bootstrap, `GET /v1/auth/bootstrap-status` must return `{"available":false}`. If it is still true, the one-time installer endpoint is open.

**Dependency errors:** Post-commit enqueue failures and auth rate-limit checks return **503** `service_unavailable` when Redis is unreachable. Treat that as “try again later,” not a successful ingest.

### Backup and upgrade

```sh
docker compose --env-file .env.production -f compose.production.yml stop api worker
docker compose --env-file .env.production -f compose.production.yml exec -T postgres pg_dump -U webhook -d webhooks -Fc > hikyaku-backup.dump
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml up -d
```

Keep the backup, previous application revision, and `.env.production` securely. Do not restart application services if migration fails. Never roll old code onto an incompatible new schema.

**Restore Postgres** (maintenance window; stops writers first):

```sh
docker compose --env-file .env.production -f compose.production.yml stop api worker
docker compose --env-file .env.production -f compose.production.yml exec -T postgres \
  pg_restore -U webhook -d webhooks --clean --if-exists < hikyaku-backup.dump
docker compose --env-file .env.production -f compose.production.yml up -d
```

Redis holds the BullMQ queue and ephemeral rate-limit counters. After restoring only Postgres, committed `delivery_outbox` rows and the sweeper can rebuild queue work; do not assume Redis snapshots are required for correctness. Prefer a coordinated restore or accept re-enqueue via outbox/sweeper rather than mixing an old Redis volume with a newer database without a plan.

**Signing-secret rotation** replaces the endpoint secret immediately (no dual-secret overlap). Pause traffic or update receivers before rotating if you cannot tolerate verification failures on in-flight sends.

---

## Optional: Vercel + Railway

Split hosting is **optional**. Prefer Compose above unless you specifically want a separate frontend host.

- Web on **Vercel**, API + worker on **Railway**
- `vercel.json` proxies browser `/v1` to Railway so the session cookie stays on the Vercel origin
- Caddy (Compose) and `vercel.json` set nosniff / frame deny / referrer / CSP on the web origin; the API sets the same class of headers itself (lock-down CSP)
Cookie mutations fail with `403 origin_not_allowed` unless all four match:

1. Vercel `API_UPSTREAM_URL` = public Railway API origin; leave `VITE_API_URL` unset  
2. Shared `PROXY_IP_SECRET` (≥16 chars) on Vercel **and** Railway API  
3. Railway `CORS_ORIGIN` + `WEB_APP_URL` = the Vercel https origin (no trailing slash)  
4. Railway `TRUST_PROXY=1`

Also set `ENABLE_EXPERIMENTAL_COREPACK=1` on Vercel.
- Set `VITE_PUBLIC_SITE_URL` to the Vercel https origin (no trailing slash) so Open Graph image URLs are absolute
- Set `VITE_PUBLIC_API_URL` to the Railway origin on the Vercel build for docs/curl samples
- Pre-deploy: `node apps/api/dist/scripts/migrate.js`
- Build/start from **repo root** with `pnpm --filter @hikyaku/api...` / `@hikyaku/worker` — do not set root directory to `apps/api` or `apps/worker`
- Worker: no public domain / healthcheck; API healthcheck → `/v1/ready`
- Vercel preview URLs are separate origins; add them to `CORS_ORIGIN` if needed

### Public metadata deployment check

Set `VITE_PUBLIC_SITE_URL=https://hikyaku.nayanswarnkar.com` on the Vercel build, then deploy the commit containing the metadata and `apps/web/public/og.png`. This is a build-time value; changing it requires a fresh build.

After deployment, verify:

- `/` HTML contains absolute `og:image` and `twitter:image` URLs ending in `/og.png`, plus `og:url` and canonical pointing to the public origin.
- `/og.png` returns a PNG with dimensions **1200 × 630**.
- `/robots.txt` returns plain text and `/sitemap.xml` returns XML, both with HTTP 200 rather than the SPA HTML.
- `/login` and console/auth routes return `X-Robots-Tag: noindex, nofollow`.

The website and terminal walkthroughs link to the public docs. A hosted console recording is optional: set `VITE_WALKTHROUGH_URL` and rebuild to show the additional **Console video** link. Leave it unset until a real recording is available.

---

## Read-only console demo

This is optional for the résumé demo. It adds one non-admin workspace with synthetic orders, example.com endpoints, and terminal delivery/attempt records. It creates **no API keys, pending deliveries, outbox rows, or queue jobs**. Sample timestamps are fixed when seeded; 24-hour metrics naturally age out. The banner labels the data as synthetic.

### Rollout order

1. Run normal migrations, including `0024_read_only_tenants.sql` (existing workspaces default to writable).
2. Deploy the API containing read-only enforcement and wait until **all older API replicas are gone**. Leave `VITE_DEMO_LOGIN` unset. Keep bootstrap closed on the existing public install.
3. After an installer administrator exists, run the separate, explicit seed against the intended database, using the built API:

   ```sh
   ALLOW_DEMO_SEED=1 NODE_ENV=production node apps/api/dist/scripts/seedDemoTenant.js
   ```

   Supply the normal API environment securely. The script refuses missing opt-in, conflicting IDs/emails, and an install without an administrator. Repeating it leaves an existing protected demo unchanged. It never prints operator credentials or signing secrets. The regular dev seed remains forbidden in production.
4. Sign in at `/login` using `demo@hikyaku.example` / `hikyaku-demo-read-only`. Check `/v1/auth/me` returns `tenant.read_only: true`, bootstrap stays unavailable, reads work, and attempted writes return 403. In production, cookie mutations still require the normal allowlisted `Origin`.
5. Only then set `VITE_DEMO_LOGIN=true` on the web build and redeploy. `/login` will show the public credentials and a button to fill them. Invite-only accounts keep their normal permissions.

The API reads the current tenant flag for mutations; it does not trust a cached session permission. Demo session mutations are denied except login/logout. Bearer ingest is denied too, even if a key is inserted later. Admin changes, new tenant-user invites, password-reset creation, and consumption of existing invite/reset tokens targeting the demo are also blocked. Read-only is enforced by the backend; hiding controls is only presentation.

### Local verification and rollback

Use explicit isolated test connections as described below. The API integration suite includes `test/integration/read-only-demo.test.ts`. For the real browser flow, run:

```sh
VITE_DEMO_LOGIN=true pnpm test:smoke e2e/00-onboarding.spec.ts e2e/dashboard.spec.ts e2e/read-only-demo.spec.ts
```

That flow is also in CI. It checks normal onboarding/management plus demo navigation, hidden mutation controls, direct send-page rejection, and API write denial.

To hide demo discovery, unset `VITE_DEMO_LOGIN` and rebuild; the account still exists. Before rolling back to an API without enforcement, revoke the demo user's sessions and remove the synthetic demo workspace via trusted database administration (tenant ID `d0000000-0000-4000-8000-000000000001`). Do **not** make the public account writable as a rollback. Keep the additive column during an application rollback; do not publish demo credentials while old API replicas can accept writes.

## Reference (from root README)

### Health checks

```bash
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/ready
```

`/v1/health` — process up. `/v1/ready` — Postgres and Redis reachable.

### Web cache policy

Vercel and Caddy cache Vite's hashed `/assets/*` files for one year with `immutable`. HTML and unversioned public files (including `/og.png`) use `max-age=0, must-revalidate`. These web cache rules do not apply to `/v1` API responses.

After deploying, check an actual `/assets/…` URL from the landing HTML for `Cache-Control: public, max-age=31536000, immutable`. Check `/`, `/docs`, and `/og.png` for revalidation and confirm `/v1/ready` does not receive the one-year cache header. Vite preview does not exercise Vercel or Caddy header configuration.

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
| `BUILD_REVISION` | Optional release id on `/v1/health` and `/v1/ready` |
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

### Known limits (not bugs)

The same list is in [SECURITY.md](../SECURITY.md) and the in-app docs.

- Endpoint signing secrets are stored so the worker can sign POSTs; they are not hashed like API keys. Protect the database and backups.
- Signing-secret rotation replaces the secret immediately. There is no dual-secret window.
- Redis down: auth rate limits and ingest enqueue return **503**. The outbox can recover committed deliveries; login cannot.
- Invites and password resets are copy-paste links. There is no email delivery.
- HTTP delivery is **at-least-once**. Subscribers must dedupe on `X-Webhook-Id`.

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
