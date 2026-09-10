# Self-host Hikyaku

Requires Docker Engine with Compose v2 and Node.js 22 for the one-time configuration command.
The existing `docker-compose.yml` and `pnpm dev` remain the development workflow.

## Start

```sh
node deploy/setup.mjs
docker compose --env-file .env.production -f compose.production.yml up -d --build
```

Open https://localhost/bootstrap. Find `ADMIN_BOOTSTRAP_SECRET` in your local `.env.production` (do not commit or share it). Create your account and workspace, sign in, add a receiver, send a sample event, and inspect delivery results. The sample sends real traffic. Production receivers must be publicly resolvable HTTPS endpoints; private addresses are intentionally blocked.

Caddy issues a local certificate for localhost. Export its root certificate:

```sh
docker compose --env-file .env.production -f compose.production.yml cp web:/data/caddy/pki/authorities/local/root.crt ./hikyaku-local-root.crt
```

Trust this certificate in your operating system/browser's certificate store, then reload. On macOS import it into Keychain Access and explicitly trust it for SSL. Do not disable browser or server certificate validation. For public deployment, set `SITE_ADDRESS` to a domain (no scheme or path), point DNS at this machine, allow inbound ports 80 and 443, and rerun startup. Caddy obtains public certificates automatically. Only Caddy publishes ports; API, PostgreSQL, and Redis remain private to the Compose network.

## Operate

Use the same `--env-file .env.production -f compose.production.yml` flags for every command.

```sh
docker compose --env-file .env.production -f compose.production.yml ps -a
docker compose --env-file .env.production -f compose.production.yml logs --tail=100 api worker migrate
docker compose --env-file .env.production -f compose.production.yml down
```

`down` preserves volumes. Do not add `-v` unless intentionally deleting this installation. Redis uses AOF; PostgreSQL and Caddy certificates also persist. Worker logs report startup and queue activity. `/v1/ready` checks PostgreSQL/Redis, not delivery execution: confirm a real delivery after installation or upgrade.

## Backup and upgrade

```sh
docker compose --env-file .env.production -f compose.production.yml stop api worker
docker compose --env-file .env.production -f compose.production.yml exec -T postgres pg_dump -U webhook -d webhooks -Fc > hikyaku-backup.dump
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml up -d
```

Keep the backup, previous application revision, and `.env.production` securely. Do not restart application services if migration fails: inspect `migrate` output, correct the cause, then rerun migration. Restore a backup to a fresh database and use the matching previous application revision if rollback is needed. Never roll old code back onto an incompatible new schema. This is a maintenance-window upgrade, not a zero-downtime deployment.

The outbox recovers committed deliveries after enqueue failures. Migration 0022 recalculates historical event statuses; 0023 preserves attempts in run 0 and adds replay runs. Previously erased attempts cannot be recovered.
