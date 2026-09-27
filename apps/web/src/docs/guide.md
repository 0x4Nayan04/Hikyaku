# {{APP_NAME}} Docs

Ingest events, HMAC-signed deliveries, retries, and the delivery console.

## Introduction

{{APP_NAME}} is a multi-tenant webhook delivery system. You POST an event to the ingest API; the API fans it out to one delivery per active endpoint, and the worker signs and delivers each POST with HMAC-SHA256, retries transient failures with exponential backoff, and stores attempt history for the console.

Each tenant is an isolated workspace. API keys, endpoints, events, and deliveries do not cross tenant boundaries.

- **Endpoint** — a subscriber URL that receives signed POSTs, with its own signing secret.
- **Event** — the JSON message you ingest, identified by an idempotency key.
- **Delivery** — one event sent to one endpoint, including retries and attempt history.
- **API key** — Bearer auth for event ingest only, scoped to one tenant.

Access is invite-only — a platform admin sends a one-time link. There is no self-serve signup. Jump to [Console guide](#console-guide) for the UI tour, or keep reading for the API.

## Quick start

Pick a path below. Both need the API and worker running — `pnpm dev` starts them together.

### Console path

1. Create your installer account and first workspace at [/bootstrap](/bootstrap) (first deploy only).
2. Sign in and open your workspace dashboard. Existing admin-only accounts can use **Create my workspace** in Admin.
3. Open **Endpoints** and register a receiver URL.
4. Send a sample event using the existing **Test event** form, then inspect its deliveries. API keys are only needed afterward for backend ingest.
5. Prefer `POST /v1/events` with the key (curl below). **Test event** in the console is a smoke-test shortcut.
6. Confirm the result under **Deliveries**.

> **Tip:** Use [webhook.site](https://webhook.site) or an ngrok tunnel to inspect outbound POSTs while you wire up a real handler.

### API-only path

Create an API key under **Settings → API keys**, then ingest:

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

A successful ingest returns `202 Accepted` with the event id and enqueues one delivery per active endpoint. If deliveries stay pending, check that the worker process is running.

## Console guide

Fresh deploys create a super-admin and their workspace at [/bootstrap](/bootstrap). Additional users arrive through invitation links. Console data is scoped to the signed-in tenant.

- **Dashboard** — ingest volume, active deliveries, 24h final outcomes, and recent activity.
- **Endpoints** — register a receiver URL, copy the signing secret shown once at create, and rotate it in place when needed.
- **Events** — browse ingested events and open one to see its deliveries.
- **Test event** — POST a smoke-test payload from the UI (real traffic should use `POST /v1/events`).
- **Deliveries** — filter by status, inspect attempt timelines, and replay failures.
- **Settings** — API keys, tenant identity, and account password. Super-admins with a workspace also have API key and tenant tabs.

Super-admins use **Admin** to invite tenant owners, list, rename, or delete tenants, invite or remove tenant users, and issue a one-time password reset link. A super-admin can use their own assigned workspace, including deliveries and API keys. Admin remains a separate area. Workspaces linked to a super-admin cannot be deleted.

## Authentication

Backends use an API key. The console uses a session cookie. Platform ops use a super-admin session.

| Mode                | How                             | Scope                                                                 |
| ------------------- | ------------------------------- | --------------------------------------------------------------------- |
| API key             | `Authorization: Bearer whk_…`   | Single tenant                                                         |
| Session cookie      | Email/password login (httpOnly) | Tenant user console + APIs                                            |
| Super-admin session | Session cookie only             | **Admin** platform routes; assigned workspace uses tenant console too |

```http
Authorization: Bearer whk_your_api_key
```

Keys belong to one tenant. The tenant is resolved from the key, never from the request body. The full secret is shown once on create or rotate; only a SHA-256 hash is stored.

Passwords must be at least 12 characters and at most 128 UTF-8 bytes. Browser login and API keys are separate credentials that resolve to the same tenant for tenant users. Changing your password signs you out of all sessions.

A super-admin issues a password reset with `POST /v1/admin/tenants/:id/users/:userId/reset-password`. The response is a one-time link to copy, the same way invites work. The user sets a new password at [/reset-password](/reset-password), and every session for that user is signed out. There is no emailed self-serve reset.

- **Bootstrap** — create the first super-admin once via `POST /v1/auth/bootstrap` (requires `ADMIN_BOOTSTRAP_SECRET`).
- **Invite** — the super-admin creates a tenant-owner or tenant-user link via `POST /v1/admin/invites`; the recipient accepts at [/accept-invite](/accept-invite).

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

Create a key in **Settings → API keys** and save the secret immediately. The console shows the full secret once.

API key routes, including `POST /v1/api-keys`, require the console session cookie. An API key cannot create another key.

List responses show a short `prefix` for identification, never the full secret. Revoke with `POST /v1/api-keys/:id/revoke`. Rotate with `POST /v1/api-keys/:id/rotate` — it issues a replacement and invalidates the old one.

## Endpoints

An endpoint is a subscriber URL that receives signed webhook POSTs. Create one with `POST /v1/endpoints` — the signing secret is returned once. Active endpoints receive fan-out; disabled endpoints do not.

Endpoint routes require the console session cookie, not an API key. From a terminal, sign in once to save the cookie, then send it with each request. In production, requests that change data with a session cookie must also send an `Origin` header listed in `CORS_ORIGIN`.

```bash
curl -c cookies.txt -X POST "{{API_BASE}}/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": "you@example.com", "password": "your-password" }'

curl -b cookies.txt -X POST "{{API_BASE}}/v1/endpoints" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhooks",
    "description": "Production orders handler"
  }'
```

URL cannot change after create. Update status or description with `PATCH /v1/endpoints/:id`. Rotate the signing secret in place with `POST /v1/endpoints/:id/rotate` — the new secret is returned once; the endpoint id and URL stay the same. To change a URL, create a new endpoint and disable the old one.

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

List deliveries with `GET /v1/deliveries` (`?status=` a delivery status, or `open` for pending and in progress; `?updated_within=24h` for rows updated in the last 24 hours; `?event_id=`, `?limit`, `?offset`), or open one with `GET /v1/deliveries/:id` for the attempt timeline. Attempts may include a truncated response body (~1KB). The delivery list polls every 10 seconds while a visible row is pending or in progress; the detail view polls while that delivery is in flight. Polling pauses in hidden tabs. Reload an idle list to discover new deliveries.

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

| Method | Route                                                | Purpose                                                              |
| ------ | ---------------------------------------------------- | -------------------------------------------------------------------- |
| GET    | `/v1/health`                                         | Liveness probe                                                       |
| GET    | `/v1/ready`                                          | Postgres + Redis connectivity                                        |
| GET    | `/v1/auth/bootstrap-status`                          | Whether first-run bootstrap is still available                       |
| POST   | `/v1/auth/bootstrap`                                 | Installer and first workspace (`workspace_name` optional)            |
| POST   | `/v1/auth/workspace`                                 | Create an existing admin-only account’s workspace (session required) |
| GET    | `/v1/auth/invites/validate`                          | Validate invite token                                                |
| POST   | `/v1/auth/accept-invite`                             | Accept invite and create account                                     |
| POST   | `/v1/auth/login`                                     | Email/password login → session cookie                                |
| POST   | `/v1/auth/logout`                                    | End session                                                          |
| GET    | `/v1/auth/me`                                        | Current user + tenant                                                |
| POST   | `/v1/auth/change-password`                           | Change password (session)                                            |
| GET    | `/v1/auth/password-reset/validate`                   | Validate a password reset link                                       |
| POST   | `/v1/auth/password-reset`                            | Set a new password from a reset link                                 |
| GET    | `/v1/stats`                                          | Dashboard metrics (tenant auth)                                      |
| GET    | `/v1/api-keys`                                       | List API keys (prefix only)                                          |
| POST   | `/v1/api-keys`                                       | Create API key (shown once)                                          |
| POST   | `/v1/api-keys/:id/revoke`                            | Revoke API key                                                       |
| POST   | `/v1/api-keys/:id/rotate`                            | Rotate API key (new key shown once)                                  |
| POST   | `/v1/endpoints`                                      | Create endpoint (secret shown once)                                  |
| GET    | `/v1/endpoints`                                      | List endpoints                                                       |
| PATCH  | `/v1/endpoints/:id`                                  | Update status or description                                         |
| POST   | `/v1/endpoints/:id/rotate`                           | Rotate signing secret (shown once)                                   |
| POST   | `/v1/events`                                         | Ingest event → 202 Accepted                                          |
| GET    | `/v1/events`                                         | List events (paginated)                                              |
| GET    | `/v1/events/:id`                                     | Event detail + delivery summary                                      |
| GET    | `/v1/deliveries`                                     | List deliveries                                                      |
| GET    | `/v1/deliveries/:id`                                 | Delivery + attempt timeline                                          |
| POST   | `/v1/deliveries/:id/replay`                          | Replay a failed or pending delivery → 202; `in_progress` → 400       |
| GET    | `/v1/admin/tenants`                                  | List tenants (super-admin)                                           |
| GET    | `/v1/admin/tenants/:id`                              | Get tenant detail                                                    |
| PATCH  | `/v1/admin/tenants/:id`                              | Rename tenant                                                        |
| DELETE | `/v1/admin/tenants/:id`                              | Delete tenant                                                        |
| GET    | `/v1/admin/tenants/:id/users`                        | List users in a tenant                                               |
| DELETE | `/v1/admin/tenants/:id/users/:userId`                | Delete a user from a tenant                                          |
| POST   | `/v1/admin/tenants/:id/users/:userId/reset-password` | Issue a one-time password reset link                                 |
| POST   | `/v1/admin/invites`                                  | Create tenant-owner or user invite                                   |

All list endpoints (`events`, `deliveries`, `api-keys`, `endpoints`) accept `?limit`/`?offset` (default 50, max 100). `events` filter by `?status=pending|completed|partial_failure|failed|no_recipients`, `api-keys` by `?status=active|revoked`, `endpoints` by `?status=active|disabled`, and `deliveries` by `?status=` (a delivery status, or `open` for pending and in progress), `?updated_within=24h`, and `?event_id=`. Responses look like `{ data, has_more, limit, offset }`.

Ingest (`POST /v1/events`) accepts a Bearer API key or a tenant session cookie. Every other tenant route requires a tenant session cookie. Admin routes require a super-admin session. Auth routes are public except logout, me, change-password, and workspace creation.

## Retries

Transient failures retry automatically. Permanent client errors fail fast. After a delivery is exhausted, you can replay it from the API or the console.

| Setting           | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Max HTTP attempts | 5 per delivery run                                         |
| Backoff           | Exponential backoff (1m → 2m → 4m → 8m), no jitter, no cap |
| Success           | HTTP 2xx within 30s                                        |
| Retryable         | Network error, timeout, 408, 429, 5xx                      |
| Fail-fast         | 4xx (except 408, 429)                                      |
| Rate limit        | 100 outbound admissions / minute / tenant                  |

> When a tenant hits the rate limit, the worker defers the delivery until the next UTC minute plus a small jitter (logged as `rate_limited`). That pause is not a failure, does not update the delivery row’s `last_error`, and does not count toward the five-attempt cap. The admission is taken before the attempt is reserved, so a lost claim spends a rate-limit slot without sending or consuming an attempt.

The worker reserves the attempt number in the database before the HTTP call. A reserved attempt counts toward the cap, including one interrupted by a crash. If the process dies after reservation and before the request is sent, that slot is still consumed and no HTTP call was made. Attempt history stores only committed outcomes, so an interrupted attempt can leave a gap in the timeline. A pending row whose `next_retry_at` is still in the future is not claimed. An early queue job finishes without sending, and the sweeper enqueues the delivery once the retry time has passed and the row is stale.

A response counts as success only when it finishes. A stream error or a connection that closes before the body ends is a transport failure and follows the retry rules, even if some body bytes and a 2xx status already arrived. The receiver may already have processed the webhook, so the retry can deliver a duplicate. Response bodies stored on the attempt are still truncated to about 1 KB. Timeouts stay timeouts.

Delivery is at-least-once — dedupe on your side with `X-Webhook-Id` (stable across retries). A transactional outbox covers ingest→queue handoff (see [Outbox](#outbox)). A background sweeper reclaims deliveries left `in_progress` after the worker lease expires (the delivery timeout plus 30 seconds) and re-enqueues them without resetting the attempt count. The sweeper runs every 5 minutes by default (`SWEEP_INTERVAL_MS`). It also re-enqueues a pending delivery once `next_retry_at` is due.

`POST /v1/deliveries/:id/replay` starts a new run only for a `failed` delivery. That call returns `202`, increments `replay_count`, resets the current run’s attempt counter and `next_retry_at`, and keeps previous attempts. You can do the same with **Replay** on the delivery detail page. Attempts expose `run_number`, starting at 0; the delivery ID and X-Webhook-Id remain unchanged. Replaying a `pending` delivery also returns `202` and re-enqueues that same run without changing the attempt count, run number, or `next_retry_at`. Replaying `in_progress` returns `400 invalid_state`: the sweeper recovers that delivery after the lease expires, and resetting it could start a competing send. A succeeded delivery, or any delivery whose endpoint is disabled, returns `400 invalid_state`.

## Privacy

API keys are stored as SHA-256 hashes; the full secret is shown only on create or rotate. Endpoint signing secrets are kept server-side so the worker can sign outbound POSTs, and are shown once at creation or when rotated in place. Session cookies power the console. Delivery attempt logs may include a truncated response body (~1KB) for debugging. There is no application-level encryption at rest beyond what your database and filesystem provide.

> **Protect secrets:** Do not commit API keys or signing secrets to source control or paste them into tickets. Revoke a compromised API key from Settings immediately. Rotate a compromised endpoint signing secret with `POST /v1/endpoints/:id/rotate` (or **Rotate signing secret** in the console), then update receivers before they reject the new signatures.

Temporary DNS lookup failures use the normal bounded delivery retries. Private and loopback addresses are blocked when `NODE_ENV=production` and allowed outside production for local testing. Supported protocols, URL safety checks, and hostname resolution still apply in every environment, and endpoint registration rejects unresolved hostnames.
