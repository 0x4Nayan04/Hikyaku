# {{APP_NAME}} Docs

Ingest events, HMAC-signed deliveries, retries, and the delivery console.

### Start here

- **[API](#api-only-path)** — Sign in from a terminal, register a receiver, send an event, inspect or retry deliveries.
- **[Console](#console-path)** — The same jobs in the website.
- **[Signing](#signing)** — Verify `X-Webhook-Signature` (HMAC-SHA256) on the receiver.
- **[OpenAPI reference](/openapi.yaml)** — Download the OpenAPI 3.1 description of routes, request bodies, responses, and authentication. Management uses a session cookie; API keys authorize event ingest only. Production cookie mutations also require an allowlisted `Origin`.

## Introduction

{{APP_NAME}} is a multi-tenant webhook delivery system: POST to the ingest API, fan out one delivery per active endpoint, and the worker signs each outbound POST with HMAC-SHA256, retries transient failures with exponential backoff, and stores attempt history.

You can do the same jobs from the website or from HTTP commands. The website is a choice, not a requirement, after the first account exists.

Each tenant is an isolated workspace. API keys, endpoints, events, and deliveries do not cross tenant boundaries.

- **Endpoint** — a subscriber URL that receives signed POSTs, with its own signing secret.
- **Event** — the JSON message you ingest, identified by an idempotency key.
- **Delivery** — one event sent to one endpoint, including retries and attempt history.
- **API key** — Bearer auth that **sends events only**, for one workspace. It cannot create endpoints, list deliveries, or replay.

Access is invite-only — a platform admin sends a one-time link. There is no self-serve signup.

## Quick start

Pick a path below. Both need the API and worker running — `pnpm dev` starts them together.

### API-only path

Work from your terminal. Sign in once, save the login cookie, then use commands to configure receivers and inspect or retry deliveries. Your application uses a separate key to send events. That key cannot manage the workspace.

Fill these in before you copy the commands:

| Value | Local default | What it is |
| --- | --- | --- |
| API address | `{{API_BASE}}` | Where `/v1` lives |
| Email / password | your account | Tenant user login |
| Receiver URL | `https://example.com/webhooks` | Where Hikyaku POSTs; [webhook.site](https://webhook.site) is fine for a first try |
| Website origin | `http://localhost:5173` | Console origin. Cookie requests that **change data** must send `Origin` set to this value, and it must be listed in `CORS_ORIGIN`. Local `pnpm dev` does not enforce that header; production does. |

First install only: create the installer account with the [bootstrap](#authentication) command, then come back here to sign in.

**1. Sign in** — save the session cookie. Sessions expire; sign in again if a later command returns `401 unauthorized`.

```bash
curl -c cookies.txt -X POST "{{API_BASE}}/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": "you@example.com", "password": "your-password" }'
```

**2. Prepare delivery** — create a receiver and a send key. Copy `secret` and `api_key` from the responses immediately; the server will not show them again.

```bash
curl -b cookies.txt -X POST "{{API_BASE}}/v1/endpoints" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{
    "url": "https://example.com/webhooks",
    "description": "Orders handler"
  }'
```

```bash
curl -b cookies.txt -X POST "{{API_BASE}}/v1/api-keys" \
  -H "Origin: http://localhost:5173"
```

**3. Send and inspect** — send with the key, then list that event’s deliveries with the cookie. `202 Accepted` means the event is queued, not that every delivery succeeded. If rows stay `pending`, the worker is not running.

```bash
curl -X POST "{{API_BASE}}/v1/events" \
  -H "Authorization: Bearer whk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "order-123-paid",
    "type": "order.paid",
    "payload": { "order_id": "123", "amount": 4999 }
  }'
```

Copy `id` from that response, then:

```bash
curl -b cookies.txt "{{API_BASE}}/v1/deliveries?event_id=EVENT_UUID"
```

**4. Retry a failure** — an empty `data` array means there is nothing to replay.

```bash
curl -b cookies.txt "{{API_BASE}}/v1/deliveries?status=failed"
```

Copy a delivery `id`, then:

```bash
curl -b cookies.txt -X POST "{{API_BASE}}/v1/deliveries/DELIVERY_UUID/replay" \
  -H "Origin: http://localhost:5173"
```

`202` means the retry is accepted, not that the receiver has succeeded yet. `in_progress` and `succeeded` return `400 invalid_state`.

> **Tip:** Use [webhook.site](https://webhook.site) or an ngrok tunnel to inspect outbound POSTs while you wire up a real handler. Production rejects private and loopback receiver URLs.

### Console path

1. On a **fresh install you run**, create the installer account and first workspace at [/bootstrap](/bootstrap) (once). The public demo at hikyaku.nayanswarnkar.com is landing and docs only — its console is invite-only and bootstrap is already closed.
2. Sign in and open your workspace dashboard. Existing admin-only accounts can use **Create my workspace** in Admin.
3. Open **Endpoints** and register a receiver URL.
4. Send a test event using the existing **Test event** form, then inspect its deliveries. API keys are only needed afterward for backend ingest — or create them from the [API-only path](#api-only-path).
5. Prefer `POST /v1/events` with the key. **Test event** in the console is a smoke-test shortcut.
6. Confirm the result under **Deliveries**.

## Console guide

Fresh deploys create a super-admin and their workspace at [/bootstrap](/bootstrap). Additional users arrive through invitation links. Console data is scoped to the signed-in tenant.

- **Dashboard** — ingest volume, active deliveries, 24h final outcomes, and recent activity. Onboarding points you to **enable** an existing endpoint when every endpoint is disabled, or to **create** one when none exist.
- **Endpoints** — register a receiver URL, copy the signing secret shown once at create, and rotate it in place when needed. The list defaults to **active** receivers; use the status filter for disabled URLs.
- **Events** — browse ingested events and open one to see its deliveries.
- **Test event** — POST a smoke-test payload from the UI (real traffic should use `POST /v1/events`). After accept, the status badge updates until the event is no longer in progress.
- **Deliveries** — filter by status, inspect attempt timelines, and replay failures.
- **Settings** — API keys, tenant identity, and account password. Super-admins with a workspace also have API key and tenant tabs.

Super-admins use **Admin** to invite tenant owners, list/rename/delete tenants, invite or remove tenant users, and issue one-time password reset links. They may use an assigned workspace (deliveries, API keys) as well; **Admin** stays separate, and those workspaces cannot be deleted.

## Authentication

Backends send events with an API key. The console **and** terminal management use a session cookie. Platform ops use a super-admin session. A leaked send-key cannot change endpoints or replay deliveries.

| Mode                | How                             | Scope                                                                 |
| ------------------- | ------------------------------- | --------------------------------------------------------------------- |
| API key             | `Authorization: Bearer whk_…`   | Send events only; one workspace                                       |
| Session cookie      | Email/password login (httpOnly) | Console and the same tenant HTTP commands; sessions expire            |
| Super-admin session | Session cookie only             | **Admin** platform routes; assigned workspace uses tenant console too |

```http
Authorization: Bearer whk_your_api_key
```

Keys belong to one tenant. The tenant is resolved from the key, never from the request body. The full secret is shown once on create or rotate; only a SHA-256 hash is stored.

Passwords must be at least 12 characters and at most 128 UTF-8 bytes. Browser login and API keys are separate credentials that resolve to the same tenant for tenant users. Changing your password signs you out of all sessions. Login and other auth routes are rate limited per IP (and per email when present); if Redis is unavailable for that check, the API returns `503 service_unavailable`.

A super-admin issues a password reset with `POST /v1/admin/tenants/:id/users/:userId/reset-password`. The response is a one-time link to copy, the same way invites work. The user sets a new password at [/reset-password](/reset-password), and every session for that user is signed out. There is no emailed self-serve reset.

**Sign in** from a terminal with the command in the [API-only path](#api-only-path). Cookie requests that change data must also send `Origin` (see that walkthrough).

- **Bootstrap** — create the first super-admin once, and only while no accounts exist. After that the route returns `403 forbidden`. Then [sign in](#api-only-path).

```bash
curl -X POST "{{API_BASE}}/v1/auth/bootstrap" \
  -H "X-Admin-Secret: your_ADMIN_BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-password",
    "name": "Your name",
    "workspace_name": "My workspace"
  }'
```

- **Invite** — the super-admin creates a tenant-owner or tenant-user link via `POST /v1/admin/invites`; the recipient accepts at [/accept-invite](/accept-invite). Creating a new invite for the same email invalidates any unused, unexpired signup invite for that address so a lost link can be replaced without waiting for expiry.

## Ingest

Post an event to `POST /v1/events`. The body must include three fields and stay under **256 KiB** when serialized.

| Field             | Rules                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `idempotency_key` | 1–256 chars; unique per tenant                                                                                         |
| `type`            | 1–128 chars (e.g. `order.paid`)                                                                                        |
| `payload`         | JSON object (string keys). Integers must be safe JavaScript integers (`-9007199254740991` through `9007199254740991`). |

```json
{
  "idempotency_key": "order-123-paid",
  "type": "order.paid",
  "payload": { "order_id": "123", "amount": 4999 }
}
```

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "pending",
  "created_at": "2026-06-05T12:00:00Z"
}
```

| Status | When                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Missing or invalid fields — check the request body and rules above                                                                     |
| `409`  | The idempotency key was already used with a different event body                                                                       |
| `429`  | Too many requests — wait and retry (default 120/min per tenant; Bearer ingest also has a matching per-IP window before the key lookup) |

An event is `pending` while any delivery is open; `completed` only when all deliveries succeeded; `partial_failure` when all are terminal with mixed results; `failed` when all failed; and `no_recipients` when it has zero deliveries. List events with `GET /v1/events`, or open a single event with `GET /v1/events/:id`.

> **Idempotency:** Reusing the same `idempotency_key` with the same type and payload returns the existing event with `202`. Reusing it with a different type or payload returns `409 idempotency_mismatch`. If active endpoints were added since the first request, the retry creates only the missing deliveries.

> **Large numbers:** Put identifiers and amounts that need exact precision in strings. Ingest uses ordinary JSON parsing, so an integer outside the safe range is rejected instead of being stored losslessly. Finite fractions such as `1.5` are accepted.

## API keys

Create a key from the [API-only path](#api-only-path) (`POST /v1/api-keys` with the login cookie) or in **Settings → API keys**. Save `api_key` immediately; the full secret is shown once.

API key routes require the session cookie, not an existing send-key. An API key cannot create another key.

List responses show a short `prefix` for identification, never the full secret. Revoke with `POST /v1/api-keys/:id/revoke`. Rotate with `POST /v1/api-keys/:id/rotate` — it issues a replacement and invalidates the old one.

## Endpoints

An endpoint is a subscriber URL that receives signed webhook POSTs. Create one with `POST /v1/endpoints` — the signing secret is returned once. Active endpoints receive fan-out; disabled endpoints do not.

Endpoint routes require the session cookie, not an API key. Sign in and create the endpoint in the [API-only path](#api-only-path). In production, cookie requests that change data must send an `Origin` header listed in `CORS_ORIGIN`.

URL cannot change after create. Update status or description with `PATCH /v1/endpoints/:id`. Rotate the signing secret in place with `POST /v1/endpoints/:id/rotate` — the new secret is returned once; the endpoint id and URL stay the same. Rotation replaces the secret immediately (no overlap window); update every receiver before or right after rotating, and expect in-flight deliveries to keep using the secret that was active when they were reserved. To change a URL, create a new endpoint and disable the old one.

> **Save the secret now:** The server cannot show the signing secret again after create or rotate. Copy it into your secret manager immediately.

## Outbound

Each active endpoint gets a signed POST for every ingested event.

Subscribers receive JSON. Your ingest `payload` is nested under `data`:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "order.paid",
  "created_at": "2026-06-05T12:00:00Z",
  "data": { "order_id": "123", "amount": 4999 }
}
```

```http
Content-Type: application/json
X-Webhook-Id: <delivery_uuid>
X-Webhook-Timestamp: <unix_seconds>
X-Webhook-Signature: sha256=<hmac_hex>
User-Agent: Hikyaku/1.0
```

`X-Webhook-Id` is the delivery UUID. It stays the same across retries for that event×endpoint pair — use it to dedupe under at-least-once delivery.

- `pending` — queued, waiting to retry, or rate-limited
- `in_progress` — a reserved attempt is running. Replay returns `400 invalid_state`; the sweeper recovers a stale row after the worker lease expires.
- `succeeded` — subscriber returned 2xx
- `failed` — retries exhausted or fail-fast 4xx

List deliveries with `GET /v1/deliveries` (`?status=` a delivery status, or `open` for pending and in progress; `?updated_within=24h` for rows updated in the last 24 hours; `?event_id=`, `?limit`, `?offset`), or open one with `GET /v1/deliveries/:id` for the attempt timeline. Attempts may include a truncated response body (~1KB). The delivery list polls every 5 seconds while a loaded row is pending or in progress, and every 15 seconds otherwise; the detail view polls while that delivery is in flight. Polling pauses in hidden tabs.

## Signing

Every outbound POST is signed with HMAC-SHA256. Receivers should verify `X-Webhook-Signature` before trusting the body.

Send `X-Webhook-Timestamp` (unix seconds) and sign the UTF-8 string `timestamp.raw_body` (a literal dot between that timestamp and the raw request body) with the endpoint secret. Put the result in `X-Webhook-Signature` as `sha256=<hex>`.

> **Verify before parsing:** Always verify against the raw body bytes before `JSON.parse`. Re-serializing JSON can change whitespace and break the signature.

> **Reject stale timestamps:** Require `|now - timestamp| ≤ 300` seconds (5 minutes). Without this, a captured request stays valid forever.

### Node.js

```javascript
import crypto from 'node:crypto'

const TOLERANCE_SECONDS = 300

function verifyWebhook(rawBody, signatureHeader, timestamp, secret) {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return false

  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex')

  const received = signatureHeader.replace(/^sha256=/, '')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(received, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
```

### Python

```python
import hashlib
import hmac
import time

TOLERANCE_SECONDS = 300

def verify_webhook(raw_body: bytes, signature_header: str, timestamp: str, secret: str) -> bool:
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs(int(time.time()) - ts) > TOLERANCE_SECONDS:
        return False

    expected = hmac.new(
        secret.encode("utf-8"),
        f"{ts}.".encode("utf-8") + raw_body,
        hashlib.sha256,
    ).hexdigest()
    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)
```

## Outbox

Fan-out writes each delivery and a matching outbox row in the same Postgres transaction as the ingest. The worker drains that outbox into BullMQ before sweeping stale leases, so a committed delivery is not lost if Redis is unavailable at ingest time. Queue jobs are still at-least-once over HTTP — subscribers should dedupe on `X-Webhook-Id`.

## API reference

All routes sit under `/v1`. The base URL is the app's API origin, set via `VITE_API_URL` at build time.

Auth: **public** — no credentials. **bootstrap** — `X-Admin-Secret`. **login** — tenant session cookie. **admin** — super-admin session. **key or login** — Bearer API key or tenant session.

| Method | Route | Auth | Purpose |
| ------ | ----- | ---- | ------- |
| GET    | `/v1/health` | public | Liveness probe; optional `revision` when `BUILD_REVISION`, `GIT_SHA`, or `RAILWAY_GIT_COMMIT_SHA` is set |
| GET    | `/v1/ready` | public | Postgres + Redis connectivity; same optional `revision` |
| GET    | `/v1/auth/bootstrap-status` | public | Whether first-run bootstrap is still available |
| POST   | `/v1/auth/bootstrap` | bootstrap | Installer and first workspace (`workspace_name` optional) |
| POST   | `/v1/auth/workspace` | admin | Create an existing admin-only account’s workspace |
| GET    | `/v1/auth/invites/validate` | public | Validate invite token |
| POST   | `/v1/auth/accept-invite` | public | Accept invite and create account |
| POST   | `/v1/auth/login` | public | Email/password login → session cookie |
| POST   | `/v1/auth/logout` | login | End session |
| GET    | `/v1/auth/me` | login | Current user + tenant |
| POST   | `/v1/auth/change-password` | login | Change password |
| GET    | `/v1/auth/password-reset/validate` | public | Validate a password reset link |
| POST   | `/v1/auth/password-reset` | public | Set a new password from a reset link |
| GET    | `/v1/stats` | login | Dashboard metrics |
| GET    | `/v1/api-keys` | login | List API keys (prefix only) |
| POST   | `/v1/api-keys` | login | Create API key (shown once) |
| POST   | `/v1/api-keys/:id/revoke` | login | Revoke API key |
| POST   | `/v1/api-keys/:id/rotate` | login | Rotate API key (new key shown once) |
| POST   | `/v1/endpoints` | login | Create endpoint (secret shown once) |
| GET    | `/v1/endpoints` | login | List endpoints |
| PATCH  | `/v1/endpoints/:id` | login | Update status or description |
| POST   | `/v1/endpoints/:id/rotate` | login | Rotate signing secret (shown once) |
| POST   | `/v1/events` | key or login | Ingest event → 202 Accepted |
| GET    | `/v1/events` | login | List events (paginated) |
| GET    | `/v1/events/:id` | login | Event detail + delivery summary |
| GET    | `/v1/deliveries` | login | List deliveries |
| GET    | `/v1/deliveries/:id` | login | Delivery + attempt timeline |
| POST   | `/v1/deliveries/:id/replay` | login | Replay a failed or pending delivery → 202; `in_progress` → 400 |
| GET    | `/v1/admin/tenants` | admin | List tenants |
| GET    | `/v1/admin/tenants/:id` | admin | Get tenant detail |
| PATCH  | `/v1/admin/tenants/:id` | admin | Rename tenant |
| DELETE | `/v1/admin/tenants/:id` | admin | Delete tenant |
| GET    | `/v1/admin/tenants/:id/users` | admin | List users in a tenant |
| DELETE | `/v1/admin/tenants/:id/users/:userId` | admin | Delete a user from a tenant |
| POST   | `/v1/admin/tenants/:id/users/:userId/reset-password` | admin | Issue a one-time password reset link |
| POST   | `/v1/admin/invites` | admin | Create tenant-owner or user invite |

All list endpoints (`events`, `deliveries`, `api-keys`, `endpoints`) accept `?limit`/`?offset` (default 50, max 100). `events` filter by `?status=pending|completed|partial_failure|failed|no_recipients`, `api-keys` by `?status=active|revoked`, `endpoints` by `?status=active|disabled`, and `deliveries` by `?status=` (a delivery status, or `open` for pending and in progress), `?updated_within=24h`, and `?event_id=`. Responses look like `{ data, has_more, limit, offset }`.

Errors:

```json
{ "error": { "code": "not_found", "message": "Not found" } }
```

| Code | Status | When |
| ---- | ------ | ---- |
| `validation_error` / `invalid_json` | 400 | Bad body or query |
| `invalid_state` | 400 | Replay not allowed (`in_progress`, succeeded, or disabled endpoint) |
| `unauthorized` | 401 | Missing or wrong key or session |
| `origin_not_allowed` | 403 | Cookie write in production without an allowed `Origin` |
| `forbidden` | 403 | Bootstrap after the first account exists |
| `not_found` | 404 | Unknown id or path |
| `idempotency_mismatch` | 409 | Same ingest key, different body |
| `payload_too_large` | 413 | Body over 256 KiB |
| `rate_limited` | 429 | Ingest or login window exceeded |
| `service_unavailable` | 503 | Redis down for rate limits or enqueue |
| `internal_error` | 500 | Unexpected failure |

The send key works on `POST /v1/events` only. Every other tenant route needs the login cookie. Admin routes need a super-admin session.

## Retries

Transient failures retry automatically. Permanent client errors fail fast. After a delivery is exhausted, replay it from the [API-only path](#api-only-path) or the console. `202` means the retry is accepted, not that the receiver has succeeded. An empty failed list means there is nothing to replay.

| Setting           | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Max HTTP attempts | 5 per delivery run                                         |
| Backoff           | Exponential backoff (1m → 2m → 4m → 8m), no jitter, no cap |
| Success           | HTTP 2xx within 30s                                        |
| Retryable         | Network error, timeout, 408, 429, 5xx                      |
| Fail-fast         | 4xx (except 408, 429)                                      |
| Rate limit        | 100 outbound admissions / minute / tenant                  |

> When a tenant hits the rate limit, the worker defers the delivery until the next UTC minute plus a small jitter (logged as `rate_limited`). That pause is not a failure, does not update the delivery row’s `last_error`, and does not count toward the five-attempt cap. The admission is taken before the attempt is reserved, so a lost claim spends a rate-limit slot without sending or consuming an attempt.

The worker reserves the attempt number in the database before the HTTP call. A reserved attempt counts toward the cap, including one interrupted by a crash. If the process dies after reservation and before the request is sent, that slot is still consumed and no HTTP call was made. Attempt history stores only committed outcomes, so an interrupted attempt can leave a gap in the timeline. A pending row whose `next_retry_at` is still in the future is not claimed; an early queue job finishes without sending until the retry time is due.

A response counts as success only when it finishes. A stream error or a connection that closes before the body ends is a transport failure and follows the retry rules, even if some body bytes and a 2xx status already arrived. The receiver may already have processed the webhook, so the retry can deliver a duplicate. Response bodies stored on the attempt are still truncated to about 1 KB. Timeouts stay timeouts.

Delivery is at-least-once — dedupe with `X-Webhook-Id` (stable across retries; see [Outbound](#outbound)). Ingest→queue durability is in [Outbox](#outbox). The sweeper (default every 5 minutes, `SWEEP_INTERVAL_MS`) reclaims stale `in_progress` rows after the worker lease (delivery timeout + 30s) and re-enqueues due `pending` rows, without resetting attempt counts.

`POST /v1/deliveries/:id/replay` starts a new run only for a `failed` delivery. That call returns `202`, increments `replay_count`, resets the current run’s attempt counter and `next_retry_at`, and keeps previous attempts. You can do the same with **Replay** on the delivery detail page. Attempts expose `run_number`, starting at 0; the delivery ID and X-Webhook-Id remain unchanged. Each replay run is enqueued with a queue deduplication id of `delivery_id:replay_count`, so a new run is not confused with an older job for the same delivery. Replaying a `pending` delivery also returns `202` and re-enqueues that same run without changing the attempt count, run number, or `next_retry_at`. Replaying `in_progress` returns `400 invalid_state`: the sweeper recovers that delivery after the lease expires, and resetting it could start a competing send. A succeeded delivery, or any delivery whose endpoint is disabled, returns `400 invalid_state`.

## Privacy

API keys are stored as SHA-256 hashes; the full secret is shown only on create or rotate. Endpoint signing secrets are kept server-side so the worker can sign outbound POSTs, and are shown once at creation or when rotated in place. Session cookies power the console. Delivery attempt logs may include a truncated response body (~1KB) for debugging. There is no application-level encryption at rest beyond what your database and filesystem provide.

> **Protect secrets:** Do not commit API keys or signing secrets to source control or paste them into tickets. Revoke or rotate compromised credentials promptly ([API-only path](#api-only-path), Settings, **Rotate signing secret**, or the API routes above) and update receivers after endpoint secret rotation.

Temporary DNS lookup failures use the normal bounded delivery retries. Private and loopback addresses are blocked when `NODE_ENV=production` and allowed outside production for local testing. Supported protocols, URL safety checks, and hostname resolution still apply in every environment, and endpoint registration rejects unresolved hostnames.

## Known limits

These are product boundaries, not defects. The same list lives in [SECURITY.md](https://github.com/0x4Nayan04/Hikyaku/blob/main/SECURITY.md) and `deploy/README.md`.

- Endpoint signing secrets are stored so the worker can sign POSTs; they are not hashed like API keys. Protect the database and backups.
- Signing-secret rotation replaces the secret immediately. There is no dual-secret window.
- Redis down: auth rate limits and ingest enqueue return **503**. The outbox can recover committed deliveries; login cannot.
- Invites and password resets are copy-paste links. There is no email delivery.
- HTTP delivery is **at-least-once**. Subscribers must dedupe on `X-Webhook-Id`.
