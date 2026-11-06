# Testing

Checklist for running Hikyaku checks without touching development or production data.

## Static checks (no databases)

From the repo root:

```sh
pnpm typecheck
pnpm lint
```

## Isolated resources (required for unit, integration, smoke)

Provision Postgres and Redis **separately** from `pnpm docker:up` / production Compose.

| Rule | Requirement |
| --- | --- |
| Postgres | Database name must end in `_test` |
| Redis | URL path must be a database number **greater than zero** (for example `/15`) |
| Secrets | Test-only values; never reuse production |
| Run id | Unique `TEST_RUN_ID` per run (`^[a-zA-Z0-9_-]+$`) |
| App URLs | Unset `DATABASE_URL` and `REDIS_URL` before tests so only `TEST_*` URLs are used |

Example local file (not loaded automatically by the runners):

```sh
cp -n .env.test.example ~/.hikyaku-test.env
chmod 600 ~/.hikyaku-test.env
# Edit ~/.hikyaku-test.env to point at your isolated services.
set -a
. ~/.hikyaku-test.env
set +a
unset DATABASE_URL REDIS_URL
export TEST_RUN_ID="local-$(date +%s)"
```

## Commands

```sh
pnpm --filter @hikyaku/shared build
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate
pnpm test:unit
pnpm test:integration
pnpm test:smoke
```

`pnpm test` runs unit then integration.

### What each suite covers

| Suite | Notes |
| --- | --- |
| Unit | Package tests; API/worker unit configs still require the test env vars above |
| Integration | API cases grouped by auth, tenancy, events, delivery, platform; worker includes real BullMQ retry after HTTP 503 |
| Smoke | Playwright Chromium; starts its own API (3101), worker, and web (5181); cleans only run-owned fixtures |

Install Playwright Chromium before smoke:

```sh
pnpm exec playwright install chromium
```

## Ops defaults that differ by environment

| Setting | Production Compose default | Application default outside that stack |
| --- | --- | --- |
| Sweeper interval (`SWEEP_INTERVAL_MS`) | 30 seconds | 5 minutes |

See [deploy/README.md](../deploy/README.md#safe-tests) for Compose-oriented notes. Keep this file as the single copy-paste checklist for engineers.