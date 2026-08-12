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

1. Bootstrap the first super-admin at [/bootstrap](/bootstrap) (first deploy only).
2. From **Admin**, invite a tenant owner and send them the one-time link. Then sign in as that tenant — super-admins stay on platform ops and have no API keys tab.
3. Open **Endpoints** and register a receiver URL.
4. Create an API key under **Settings → API keys** (required for backend ingest).
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

Fresh deploys bootstrap a super-admin at [/bootstrap](/bootstrap). All tenant users arrive through invitation links. Console data is scoped to the signed-in tenant.

- **Dashboard** — ingest volume, queue depth, 24h outcomes, and recent activity.
- **Endpoints** — register a receiver URL and copy the signing secret shown once at create.
- **Events** — browse ingested events and open one to see its deliveries.
- **Test event** — POST a smoke-test payload from the UI (real traffic should use `POST /v1/events`).
- **Deliveries** — filter by status, inspect attempt timelines, and replay failures.
- **Settings** — API keys, tenant identity, and account password. Super-admins see profile/password only; they have no API key or tenant tabs.

Super-admins use **Admin** to invite tenant owners, list, rename, or delete tenants, and invite or remove tenant users. Super-admins are not tenant-scoped — they do not run tenant deliveries or hold tenant API keys.

## Authentication

Backends use an API key. The console uses a session cookie. Platform ops use a super-admin session.

| Mode                | How                             | Scope                                         |
| ------------------- | ------------------------------- | --------------------------------------------- |
| API key             | `Authorization: Bearer whk_…`   | Single tenant                                 |
| Session cookie      | Email/password login (httpOnly) | Tenant user console + APIs                    |
| Super-admin session | Session cookie only             | **Admin** platform routes — not tenant-scoped |

```http
Authorization: Bearer whk_your_api_key
```

Keys belong to one tenant. The tenant is resolved from the key, never from the request body. The full secret is shown once on create or rotate; only a SHA-256 hash is stored.

Passwords must be 12–128 characters. Browser login and API keys are separate credentials that resolve to the same tenant for tenant users. Changing your password signs you out of all sessions.

- **Bootstrap** — create the first super-admin once via `POST /v1/auth/bootstrap` (requires `ADMIN_BOOTSTRAP_SECRET`).
- **Invite** — the super-admin creates a tenant-owner or tenant-user link via `POST /v1/admin/invites`; the recipient accepts at [/accept-invite](/accept-invite).

## Ingest

Post an event to `POST /v1/events`. The body must include three fields and stay under **256 KiB** when serialized.

| Field             | Rules                           |
| ----------------- | ------------------------------- |
| `idempotency_key` | 1–256 chars; unique per tenant  |
| `type`            | 1–128 chars (e.g. `order.paid`) |
| `payload`         | JSON object (string keys)       |

```json
{
  "idempotency_key": "order-123-paid",
  "type": "order.paid",
  "payload": { "order_id": "123", "amount": 4999 }
}
```

```json
{
  "id": "evt_uuid",
  "status": "pending",
  "created_at": "2026-06-05T12:00:00Z"
}
```

| Status | When                                                               |
| ------ | ------------------------------------------------------------------ |
| `400`  | Missing or invalid fields — check the request body and rules above |
| `409`  | The idempotency key was already used with a different event body   |
| `429`  | Too many requests — wait and retry after a short delay (default 120 per minute per tenant) |

An event’s status rolls up from its deliveries: `pending` while anything is still open, `failed` when every delivery failed, and `completed` once all deliveries are terminal and at least one succeeded. An event with no active endpoints has no deliveries and completes immediately. List events with `GET /v1/events`, or open a single event with `GET /v1/events/:id`.

> **Idempotency:** Reusing the same `idempotency_key` with the same type and payload returns the existing event with `202`. Reusing it with a different type or payload returns `409 idempotency_mismatch`. If active endpoints were added since the first request, the retry creates only the missing deliveries.

## API keys

Create keys in **Settings → API keys** or via the API. The create response includes the full secret once — store it immediately.

API key routes require the console session cookie, not an API key.

```bash
curl -X POST "{{API_BASE}}/v1/api-keys" \
  -H "Content-Type: application/json"
```

List responses show a short `prefix` for identification, never the full secret. Revoke with `POST /v1/api-keys/:id/revoke`. Rotate with `POST /v1/api-keys/:id/rotate` — it issues a replacement and invalidates the old one.

## Endpoints

An endpoint is a subscriber URL that receives signed webhook POSTs. Create one with `POST /v1/endpoints` — the signing secret is returned once. Active endpoints receive fan-out; disabled endpoints do not.

Endpoint routes require the console session cookie, not an API key.

```bash
curl -X POST "{{API_BASE}}/v1/endpoints" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhooks",
    "description": "Production orders handler"
  }'
```

URL and secret cannot change after create. Update status or description with `PATCH /v1/endpoints/:id`. To change a URL or rotate a signing secret, create a new endpoint and disable the old one.

> **Save the secret now:** The server cannot show the signing secret again. Copy it into your secret manager when the endpoint is created.

## Outbound

Each active endpoint gets a signed POST for every ingested event.

Subscribers receive JSON. Your ingest `payload` is nested under `data`:

```json
{
  "id": "evt_uuid",
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
- `in_progress` — HTTP attempt running
- `succeeded` — subscriber returned 2xx
- `failed` — retries exhausted or fail-fast 4xx

List deliveries with `GET /v1/deliveries` (`?status=` any delivery status, `?event_id=`, `?limit`, `?offset`), or open one with `GET /v1/deliveries/:id` for the attempt timeline. Attempts may include a truncated response body (~1KB). The console polls while deliveries are in flight (and pauses in hidden tabs).

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

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${rawBody}`)
    .digest('hex')

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

## API reference

All routes sit under `/v1`. The base URL is the app's API origin, set via `VITE_API_URL` at build time.

| Method | Route                                   | Purpose                                  |
| ------ | --------------------------------------- | ---------------------------------------- |
| GET    | `/v1/health`                            | Liveness probe                           |
| GET    | `/v1/ready`                             | Postgres + Redis connectivity            |
| GET    | `/v1/auth/bootstrap-status`             | Whether first-run bootstrap is still available |
| POST   | `/v1/auth/bootstrap`                    | One-time super-admin bootstrap           |
| GET    | `/v1/auth/invites/validate`             | Validate invite token                    |
| POST   | `/v1/auth/accept-invite`                | Accept invite and create account         |
| POST   | `/v1/auth/login`                        | Email/password login → session cookie    |
| POST   | `/v1/auth/logout`                       | End session                              |
| GET    | `/v1/auth/me`                           | Current user + tenant                    |
| POST   | `/v1/auth/change-password`              | Change password (session)                |
| GET    | `/v1/stats`                             | Dashboard metrics (tenant auth)          |
| GET    | `/v1/api-keys`                          | List API keys (prefix only)              |
| POST   | `/v1/api-keys`                          | Create API key (shown once)              |
| POST   | `/v1/api-keys/:id/revoke`               | Revoke API key                           |
| POST   | `/v1/api-keys/:id/rotate`               | Rotate API key (new key shown once)      |
| POST   | `/v1/endpoints`                         | Create endpoint (secret shown once)      |
| GET    | `/v1/endpoints`                         | List endpoints                           |
| PATCH  | `/v1/endpoints/:id`                     | Update status or description             |
| POST   | `/v1/events`                            | Ingest event → 202 Accepted              |
| GET    | `/v1/events`                            | List events (paginated)                  |
| GET    | `/v1/events/:id`                        | Event detail + delivery summary          |
| GET    | `/v1/deliveries`                        | List deliveries                          |
| GET    | `/v1/deliveries/:id`                    | Delivery + attempt timeline              |
| POST   | `/v1/deliveries/:id/replay`             | Replay failed delivery → 202             |
| GET    | `/v1/admin/tenants`                     | List tenants (super-admin)               |
| GET    | `/v1/admin/tenants/:id`                 | Get tenant detail                        |
| PATCH  | `/v1/admin/tenants/:id`                 | Rename tenant                            |
| DELETE | `/v1/admin/tenants/:id`                 | Delete tenant                            |
| GET    | `/v1/admin/tenants/:id/users`           | List users in a tenant                   |
| DELETE | `/v1/admin/tenants/:id/users/:userId`   | Delete a user from a tenant              |
| POST   | `/v1/admin/invites`                     | Create tenant-owner or user invite       |

All list endpoints (`events`, `deliveries`, `api-keys`, `endpoints`) accept `?limit`/`?offset` (default 50, max 100). `api-keys` filter by `?status=active|revoked`, `endpoints` by `?status=active|disabled`, and `deliveries` by `?status=` plus `?event_id=`. Responses look like `{ data, total, limit, offset }`.

Ingest (`POST /v1/events`) accepts a Bearer API key or a tenant session cookie. Every other tenant route requires a tenant session cookie. Admin routes require a super-admin session. Auth routes are public except logout, me, and change-password.

## Retries

Transient failures retry automatically. Permanent client errors fail fast. After a delivery is exhausted, you can replay it from the API or the console.

| Setting           | Value                                                |
| ----------------- | ---------------------------------------------------- |
| Max HTTP attempts | 5 per delivery                                       |
| Backoff           | Exponential backoff (1m → 2m → 4m → 8m), no jitter, no cap |
| Success           | HTTP 2xx within 30s                                  |
| Retryable         | Network error, timeout, 408, 429, 5xx                |
| Fail-fast         | 4xx (except 408, 429)                                |
| Rate limit        | 100 HTTP delivery attempts / minute / tenant         |

> When a tenant hits the rate limit, the delivery stays `pending` for about 60 seconds (`last_error: rate_limited`). That pause is not a failure and does not count toward the five-attempt cap.

Delivery is at-least-once — dedupe on your side with `X-Webhook-Id` (stable across retries). A background sweeper reclaims deliveries left `in_progress` after a worker crash and re-enqueues them.

Only `failed` deliveries can be re-queued. Call `POST /v1/deliveries/:id/replay` (returns `202`), or use **Replay** on the delivery detail page. Replaying resets the attempt counter and clears the prior attempt timeline. Replaying a delivery that's already `pending`/`in_progress` returns `202` without rescheduling.

## Privacy

API keys are stored as SHA-256 hashes; the full secret is shown only on create or rotate. Endpoint signing secrets are kept server-side so the worker can sign outbound POSTs, and are shown once at creation. Session cookies power the console. Delivery attempt logs may include a truncated response body (~1KB) for debugging. There is no application-level encryption at rest beyond what your database and filesystem provide.

> **Protect secrets:** Do not commit API keys or signing secrets to source control or paste them into tickets. Revoke a compromised key from Settings immediately. To rotate an endpoint signing secret, create a new endpoint, point subscribers at it, then disable the old one — secrets cannot be rotated in place.
