# {{APP_NAME}} Docs

Ingest events, HMAC-signed deliveries, retries, and the delivery console.

## Start here

- [Quick start](#quick-start): send your first event from the console or terminal.
- [Inside Hikyaku](#inside-hikyaku): follow an event through the API and worker.
- [API reference](#api-reference): find routes and authentication.
- [Configuration](#configuration), [deployment](#deployment) and [testing](#testing): operate your own installation.
- [Signing](#signing): verify requests at your receiver.
- [Troubleshooting](#troubleshooting-a-delivery): investigate delivery failures.

[Download the OpenAPI reference](/openapi.yaml) — The OpenAPI 3.1 description of routes, request bodies, responses, and authentication. Management uses a session cookie; API keys authorize event ingest only. Production cookie mutations also require an allowlisted `Origin`.

## Introduction

{{APP_NAME}} is a multi-tenant webhook delivery system: POST to the ingest API, fan out one delivery per active endpoint, and the worker signs each outbound POST with HMAC-SHA256, retries transient failures with exponential backoff, and stores attempt history.

You can do the same jobs from the website or from HTTP commands. The website is a choice, not a requirement, after the first account exists.

Each tenant is an isolated workspace. API keys, endpoints, events, and deliveries do not cross tenant boundaries.

- **Endpoint** — a subscriber URL that receives signed POSTs, with its own signing secret.
- **Event** — the JSON message you ingest, identified by an idempotency key.
- **Delivery** — one event sent to one endpoint, including retries and attempt history.
- **API key** — Bearer auth that **sends events only**, for one workspace. It cannot create endpoints, list deliveries, or replay.

Workspace access is invite-only — a platform admin sends a one-time link. There is no self-serve signup. If enabled by the operator, [/login](/login) also offers a read-only demo with synthetic sample data; it cannot send webhooks or change settings.

## Quick start

Pick a path below. Both need the API and worker running — `pnpm dev` starts them together.

### API-only path

Work from your terminal. Sign in once, save the login cookie, then use commands to configure receivers and inspect or retry deliveries. Your application uses a separate key to send events. That key cannot manage the workspace.

The examples use the local API and website origins. For a hosted installation, replace both localhost addresses with your own API and console origins before running the commands. Fill in the remaining values:

| Value            | Configured example             | What it is                                                                                                                                                                                                                                                                                 |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API address      | `http://localhost:3000`        | Where `/v1` lives                                                                                                                                                                                                                                                                          |
| Email / password | your account                   | Tenant user login                                                                                                                                                                                                                                                                          |
| Receiver URL     | `https://example.com/webhooks` | Where Hikyaku POSTs; [webhook.site](https://webhook.site) is fine for a first try                                                                                                                                                                                                          |
| Website origin   | `http://localhost:5173`        | The console origin. Cookie requests that **change data** must send `Origin` set to this value. On a hosted deployment, the API must allowlist this exact console origin in `CORS_ORIGIN`. Local `pnpm dev` defaults to `http://localhost:5173`; the production API enforces the allowlist. |

First install only: create the installer account with the [bootstrap](#authentication) command, then come back here to sign in.

**1. Sign in** — save the session cookie. Sessions expire; sign in again if a later command returns `401 unauthorized`.

```bash
curl -c cookies.txt -X POST "http://localhost:3000/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": "you@example.com", "password": "your-password" }'
```

**2. Prepare delivery** — create a receiver and a send key. Copy `secret` and `api_key` from the responses immediately; the server will not show them again.

```bash
curl -b cookies.txt -X POST "http://localhost:3000/v1/endpoints" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{
    "url": "https://example.com/webhooks",
    "description": "Orders handler"
  }'
```

```bash
curl -b cookies.txt -X POST "http://localhost:3000/v1/api-keys" \
  -H "Origin: http://localhost:5173"
```

**3. Send and inspect** — send with the key, then list that event’s deliveries with the cookie.

- `202 Accepted` means ingest was accepted, not that every delivery succeeded.
- A pending delivery may be queued, waiting for a retry, or rate-limited.
- Check the worker and its logs if it does not progress.

```bash
curl -X POST "http://localhost:3000/v1/events" \
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
curl -b cookies.txt "http://localhost:3000/v1/deliveries?event_id=EVENT_UUID"
```

**4. Retry a failure** — an empty `data` array means there is nothing to replay.

```bash
curl -b cookies.txt "http://localhost:3000/v1/deliveries?status=failed"
```

Copy a delivery `id`, then:

```bash
curl -b cookies.txt -X POST "http://localhost:3000/v1/deliveries/DELIVERY_UUID/replay" \
  -H "Origin: http://localhost:5173"
```

- `202` means the retry is accepted, not that the receiver has succeeded yet.
- `in_progress` and `succeeded` return `400 invalid_state`.

> **Tip:** Use [webhook.site](https://webhook.site) or an ngrok tunnel to inspect outbound POSTs while you wire up a real handler. Production rejects private and loopback receiver URLs.

### Console path

1. On a **fresh install you run**, create the installer account and first workspace at [/bootstrap](/bootstrap) (once). Bootstrap is already closed on the public demo. Full workspace access requires an invite; an optional read-only demo login lets visitors inspect samples without performing the writes below.
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

### Admin

Super-admins use **Admin** to:

- Invite tenant owners
- List, rename, or delete tenants
- Invite or remove tenant users
- Issue one-time password reset links

They may use an assigned workspace (deliveries, API keys) as well. **Admin** stays separate, and those workspaces cannot be deleted.

### Session outages

- If the console cannot check your session because the API or network is unavailable, it shows an error with **Try again** instead of treating the outage as a logout.
- An expired or invalid session still returns you to sign-in.

## Inside Hikyaku

When you press **Send test event**, Hikyaku accepts the event first and delivers it in the background.

- An **event** is the message.
- A **delivery** is the work of sending that message to one registered endpoint.
- A delivery can have multiple attempts.
- One event can have a separate delivery for each active endpoint.

![A webhook travels from a producer through the API, database, queue and worker to a receiver. An outbox and sweeper recover unfinished handoffs.](/illustrations/event-journey.svg)

[Open the full-size diagram](/illustrations/event-journey.svg) for a closer view.

1. **The console sends a request.** The test-event form checks that an active endpoint exists, validates the JSON object and sends `POST /v1/events` using your signed-in session. A producer can send the same request with an ingest API key.
2. **The API checks the request.** Authentication identifies the workspace; validation checks the event type, idempotency key and payload. A client cannot choose another workspace by changing the request body.
3. **PostgreSQL saves the work.** One transaction stores the event, a delivery for each active endpoint and the matching outbox entries. If there are no active endpoints, the event becomes `no_recipients`.
4. **Redis holds delivery jobs.** After the transaction commits, the API publishes jobs to the queue. A `202 Accepted` means Hikyaku accepted the event; it does not mean that the receiver has responded yet.
5. **The worker sends the webhook.** It claims a due delivery, signs the request and records the response and attempt. Transient failures can be retried; the receiver should verify the signature and deduplicate by `X-Webhook-Id`.
6. **The console reads the result.** Event and delivery pages fetch stored status and attempt history. A pending event refreshes while it remains open; refresh stops when it reaches a terminal status.

> If queue publishing fails after the database commit, the API can return `503` even though the event was saved. The worker's sweeper can recover the outbox entries later. Retry an uncertain request with the **same idempotency key and body**; a different body with that key is rejected. See [Outbox](#outbox) and [Retries](#retries) for details.

The diagrams below show the system boundaries, components, ingest flow, and main database relationships. Their Mermaid source files are in `docs/diagrams/`; the static SVG illustrations are manually authored equivalents.

![System context: a producer and console user send requests to Hikyaku, which delivers signed requests to a receiver.](/illustrations/docs-context.svg)

[Open the system context diagram](/illustrations/docs-context.svg).

![Components: the console, API, PostgreSQL, Redis queue, worker and receiver exchange requests and delivery work.](/illustrations/docs-components.svg)

[Open the components diagram](/illustrations/docs-components.svg).

![Ingest sequence: the API commits events, deliveries and outbox rows, then publishes jobs; the worker recovers outbox work and sends signed requests.](/illustrations/docs-ingest-sequence.svg)

[Open the ingest and recovery diagram](/illustrations/docs-ingest-sequence.svg). A request with no active endpoints produces `no_recipients` and zero deliveries. A publish failure can return `503` after commit. Delivery is at-least-once.

![Data model: tenants own workspace records; deliveries connect events and endpoints to outbox rows and attempts; sessions contain JSON without a user foreign key.](/illustrations/docs-er-model.svg)

[Open the data model diagram](/illustrations/docs-er-model.svg). The sessions table stores session JSON and has no user foreign key.

## Find your way around the code

Start from an action a user can take. Follow the request into the API, then the worker and shared data model. Paths below are relative to the repository root.

| If you want to change…                    | Start here                                | Then follow                                                                             |
| ----------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Test-event form or accepted status        | `apps/web/src/pages/events/SendEvent.tsx` | `apps/web/src/pages/events/useEndpointAvailability.ts` and `useAcceptedEventPolling.ts` |
| Event validation, ingest or fanout        | `apps/api/src/routes/events/`             | `apps/api/src/ingest/fanout.ts` and `apps/api/src/queue/publish.ts`                     |
| Delivery, retries or crash recovery       | `apps/worker/src/processor.ts`            | `apps/worker/src/backoff.ts` and `apps/worker/src/sweeper.ts`                           |
| Workspace permissions or sessions         | `apps/api/src/auth/`                      | `apps/api/src/routes/admin/` and `apps/web/src/providers/SessionProvider.tsx`           |
| Shared tables, schemas or queue contracts | `packages/shared/src/`                    | The API and worker callers that use the changed export                                  |
| Console page or its filters               | `apps/web/src/pages/`                     | Its API client calls and nearby page tests                                              |

### First contribution path

1. Follow the **Test event** button from the page to `sendEvent` in the web API client.
2. Continue to `ingestEvent` in the API handler and `ingestFanout` in the transaction.
3. Follow the queued delivery to the worker.
4. Read the related tests before changing behaviour: event and delivery integration tests cover authentication, fanout and replay; worker integration tests cover delivery and recovery.

The repository README explains local setup and verification commands. Run service-backed tests only against disposable PostgreSQL and Redis resources, separate from the running application.

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

### Keys and passwords

- Keys belong to one tenant. The tenant is resolved from the key, never from the request body.
- The full secret is shown once on create or rotate; only a SHA-256 hash is stored.
- Passwords must be at least 12 characters and at most 128 UTF-8 bytes.
- Browser login and API keys are separate credentials that resolve to the same tenant for tenant users.
- Changing your password signs you out of all sessions.
- Login and password reset are rate limited per IP (and per email when present). If Redis is unavailable for that check, the API returns `503 service_unavailable`.

### Password reset

A super-admin issues a password reset with `POST /v1/admin/tenants/:id/users/:userId/reset-password`.

- The response is a one-time link to copy, the same way invites work.
- The user sets a new password at [/reset-password](/reset-password).
- Every session for that user is signed out.
- There is no emailed self-serve reset.

**Sign in** from a terminal with the command in the [API-only path](#api-only-path). Cookie requests that change data must also send `Origin` (see that walkthrough).

### Bootstrap

Create the first super-admin once, and only while no accounts exist. After that the route returns `403 forbidden`. Then [sign in](#api-only-path).

```bash
curl -X POST "http://localhost:3000/v1/auth/bootstrap" \
  -H "X-Admin-Secret: your_ADMIN_BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-password",
    "name": "Your name",
    "workspace_name": "My workspace"
  }'
```

### Invite

- The super-admin creates a tenant-owner or tenant-user link via `POST /v1/admin/invites`.
- The recipient accepts at [/accept-invite](/accept-invite).
- Creating a new invite for the same email invalidates any unused, unexpired signup invite for that address so a lost link can be replaced without waiting for expiry.

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

### Event status

| Status            | When                                      |
| ----------------- | ----------------------------------------- |
| `pending`         | Any delivery is still open                |
| `completed`       | All deliveries succeeded                  |
| `partial_failure` | All terminal with mixed results           |
| `failed`          | All failed                                |
| `no_recipients`   | Zero deliveries                           |

List events with `GET /v1/events`, or open a single event with `GET /v1/events/:id`.

> **Idempotency:** Reusing the same `idempotency_key` with the same type and payload returns the existing event with `202` if enqueue succeeds. Reusing it with a different type or payload returns `409 idempotency_mismatch`. If active endpoints were added since the first request, the retry creates only the missing deliveries and can re-enqueue existing open deliveries.

> **Enqueue failure:** A `503 service_unavailable` can occur after the event and outbox are committed. The worker may deliver the event after Redis recovers even though the request returned `503`. Retry the same body with the same idempotency key and inspect the event rather than generating a new key.

> **Large numbers:** Put identifiers and amounts that need exact precision in strings. Ingest uses ordinary JSON parsing, so an integer outside the safe range is rejected instead of being stored losslessly. Finite fractions such as `1.5` are accepted.

## API keys

Create a key from the [API-only path](#api-only-path) (`POST /v1/api-keys` with the login cookie) or in **Settings → API keys**. Save `api_key` immediately; the full secret is shown once.

- API key routes require the session cookie, not an existing send-key.
- An API key cannot create another key.
- List responses show a short `prefix` for identification, never the full secret.
- Revoke with `POST /v1/api-keys/:id/revoke`.
- Rotate with `POST /v1/api-keys/:id/rotate` — it issues a replacement and invalidates the old one.

## Endpoints

An endpoint is a subscriber URL that receives signed webhook POSTs. Create one with `POST /v1/endpoints` — the signing secret is returned once. Active endpoints receive fan-out; disabled endpoints do not.

Endpoint routes require the session cookie, not an API key. Sign in and create the endpoint in the [API-only path](#api-only-path). In production, cookie requests that change data must send an `Origin` header listed in `CORS_ORIGIN`.

### Create and update

- URL cannot change after create.
- Update status or description with `PATCH /v1/endpoints/:id`.
- To change a URL, create a new endpoint and disable or remove the old one.

### Signing secret rotation

Rotate in place with `POST /v1/endpoints/:id/rotate`:

- The new secret is returned once; the endpoint id and URL stay the same.
- Rotation replaces the secret immediately (no overlap window).
- Update every receiver before or right after rotating.
- In-flight deliveries keep using the secret that was active when they were reserved.

### Remove an endpoint

Use **Remove endpoint** in the endpoint actions menu, or `DELETE /v1/endpoints/:id`.

| What happens              | Detail                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| Lists                     | Removed endpoints disappear from every endpoint list                            |
| Restore / edit / rotate   | Not allowed                                                                     |
| Replay                    | Their deliveries cannot be replayed                                             |
| History                   | Server retains the endpoint row, deliveries, and attempt history                |
| Queued work               | Stops without sending HTTP; final error `endpoint_removed`                      |
| Response                  | `204` with no body, including repeated removal in the same workspace            |
| Unknown / other workspace | `404`                                                                           |
| Read-only workspaces      | Cannot remove endpoints                                                         |

Delivery detail exposes `endpoint_deleted_at` (timestamp or null) and shows a removed marker without an enable link. The confirmation explains that delivery history is retained and an already claimed delivery may finish.

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

### Delivery status

- `pending` — queued, waiting to retry, or rate-limited
- `in_progress` — a reserved attempt is running. Replay returns `400 invalid_state`; the sweeper recovers a stale row after the worker lease expires.
- `succeeded` — subscriber returned 2xx
- `failed` — retries exhausted or fail-fast 4xx

### Listing and polling

- List: `GET /v1/deliveries` with `?status=` (a delivery status, or `open` for pending and in progress), `?updated_within=24h`, `?event_id=`, `?limit`, `?offset`.
- Detail: `GET /v1/deliveries/:id` for the attempt timeline.
- Attempts may include a truncated response body (~1KB).
- List polls every 5 seconds while a loaded row is pending or in progress, and every 15 seconds otherwise.
- Detail polls while that delivery is in flight.
- Polling pauses in hidden tabs.

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

Fan-out writes each delivery and a matching outbox row in the same Postgres transaction as the ingest.

- The worker drains that outbox into BullMQ before sweeping stale leases.
- A committed delivery is not lost if Redis is unavailable at ingest time.
- Queue jobs are still at-least-once over HTTP — subscribers should dedupe on `X-Webhook-Id`.

## API reference

All routes sit under `/v1`. The examples use `http://localhost:3000`; replace it with your own API origin for a hosted installation.

- The browser uses `VITE_API_URL` when set at build time.
- When unset, development defaults to `http://localhost:3000`.
- A production build uses the current origin.

Auth: **public** — no credentials. **bootstrap** — `X-Admin-Secret`. **login** — tenant session cookie. **admin** — super-admin session. **key or login** — Bearer API key or tenant session.

| Method | Route                                                | Auth         | Purpose                                                                                                  |
| ------ | ---------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/health`                                         | public       | Liveness probe; optional `revision` when `BUILD_REVISION`, `GIT_SHA`, or `RAILWAY_GIT_COMMIT_SHA` is set |
| GET    | `/v1/ready`                                          | public       | Postgres + Redis connectivity; same optional `revision`                                                  |
| GET    | `/v1/auth/bootstrap-status`                          | public       | Whether first-run bootstrap is still available                                                           |
| POST   | `/v1/auth/bootstrap`                                 | bootstrap    | Installer and first workspace (`workspace_name` optional)                                                |
| POST   | `/v1/auth/workspace`                                 | admin        | Create an existing admin-only account’s workspace                                                        |
| GET    | `/v1/auth/invites/validate`                          | public       | Validate invite token                                                                                    |
| POST   | `/v1/auth/accept-invite`                             | public       | Accept invite and create account                                                                         |
| POST   | `/v1/auth/login`                                     | public       | Email/password login → session cookie                                                                    |
| POST   | `/v1/auth/logout`                                    | login        | End session                                                                                              |
| GET    | `/v1/auth/me`                                        | login        | Current user + tenant                                                                                    |
| POST   | `/v1/auth/change-password`                           | login        | Change password                                                                                          |
| GET    | `/v1/auth/password-reset/validate`                   | public       | Validate a password reset link                                                                           |
| POST   | `/v1/auth/password-reset`                            | public       | Set a new password from a reset link                                                                     |
| GET    | `/v1/stats`                                          | login        | Dashboard metrics                                                                                        |
| GET    | `/v1/api-keys`                                       | login        | List API keys (prefix only)                                                                              |
| POST   | `/v1/api-keys`                                       | login        | Create API key (shown once)                                                                              |
| POST   | `/v1/api-keys/:id/revoke`                            | login        | Revoke API key                                                                                           |
| POST   | `/v1/api-keys/:id/rotate`                            | login        | Rotate API key (new key shown once)                                                                      |
| POST   | `/v1/endpoints`                                      | login        | Create endpoint (secret shown once)                                                                      |
| GET    | `/v1/endpoints`                                      | login        | List endpoints, excluding removed receivers                                                              |
| DELETE | `/v1/endpoints/:id`                                  | login        | Permanently remove receiver; retain delivery history                                                     |
| PATCH  | `/v1/endpoints/:id`                                  | login        | Update status or description                                                                             |
| POST   | `/v1/endpoints/:id/rotate`                           | login        | Rotate signing secret (shown once)                                                                       |
| POST   | `/v1/events`                                         | key or login | Ingest event → 202 Accepted                                                                              |
| GET    | `/v1/events`                                         | login        | List events (paginated)                                                                                  |
| GET    | `/v1/events/:id`                                     | login        | Event detail + delivery summary                                                                          |
| GET    | `/v1/deliveries`                                     | login        | List deliveries                                                                                          |
| GET    | `/v1/deliveries/:id`                                 | login        | Delivery + attempt timeline                                                                              |
| POST   | `/v1/deliveries/:id/replay`                          | login        | Replay a failed or pending delivery → 202; `in_progress` → 400                                           |
| GET    | `/v1/admin/tenants`                                  | admin        | List tenants                                                                                             |
| GET    | `/v1/admin/tenants/:id`                              | admin        | Get tenant detail                                                                                        |
| PATCH  | `/v1/admin/tenants/:id`                              | admin        | Rename tenant                                                                                            |
| DELETE | `/v1/admin/tenants/:id`                              | admin        | Delete tenant                                                                                            |
| GET    | `/v1/admin/tenants/:id/users`                        | admin        | List users in a tenant                                                                                   |
| DELETE | `/v1/admin/tenants/:id/users/:userId`                | admin        | Delete a user from a tenant                                                                              |
| POST   | `/v1/admin/tenants/:id/users/:userId/reset-password` | admin        | Issue a one-time password reset link                                                                     |
| POST   | `/v1/admin/invites`                                  | admin        | Create tenant-owner or user invite                                                                       |

### List query parameters

All list endpoints (`events`, `deliveries`, `api-keys`, `endpoints`) accept:

| Parameter                    | Rules                                                         |
| ---------------------------- | ------------------------------------------------------------- |
| `limit` / `offset`           | Defaults 50 and 0. Limits clamped to 1–100; offsets ≥ 0       |
| Invalid or unsafe integers   | `400 validation_error`                                        |
| Repeated query parameter     | First value is used                                           |

| Resource     | Filters                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `events`     | `?status=pending\|completed\|partial_failure\|failed\|no_recipients`                             |
| `api-keys`   | `?status=active\|revoked`                                                                        |
| `endpoints`  | `?status=active\|disabled`                                                                       |
| `deliveries` | `?status=` (a delivery status, or `open`), `?updated_within=24h`, `?event_id=`                   |

Responses look like `{ data, has_more, limit, offset }`.

### Errors

```json
{ "error": { "code": "not_found", "message": "Not found" } }
```

| Code                                | Status | When                                                                           |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `validation_error` / `invalid_json` | 400    | Bad body or query                                                              |
| `invalid_state`                     | 400    | Replay not allowed (`in_progress`, succeeded, or disabled or removed endpoint) |
| `unauthorized`                      | 401    | Missing or wrong key or session                                                |
| `origin_not_allowed`                | 403    | Cookie write in production without an allowed `Origin`                         |
| `forbidden`                         | 403    | Bootstrap after the first account exists                                       |
| `not_found`                         | 404    | Unknown id or path                                                             |
| `idempotency_mismatch`              | 409    | Same ingest key, different body                                                |
| `payload_too_large`                 | 413    | Body over 256 KiB                                                              |
| `rate_limited`                      | 429    | Ingest, login or password reset window exceeded                                |
| `service_unavailable`               | 503    | Redis down for rate limits or enqueue                                          |
| `internal_error`                    | 500    | Unexpected failure                                                             |

The send key works on `POST /v1/events` only. Every other tenant route needs the login cookie. Admin routes need a super-admin session.

## Retries

Transient failures retry automatically. Permanent client errors fail fast. After a delivery is exhausted, replay it from the [API-only path](#api-only-path) or the console.

- `202` means the retry is accepted, not that the receiver has succeeded.
- An empty failed list means there is nothing to replay.

| Setting           | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Max HTTP attempts | 5 per delivery run                                         |
| Backoff           | Exponential backoff (1m → 2m → 4m → 8m), no jitter, no cap |
| Success           | HTTP 2xx within 30s                                        |
| Retryable         | Network error, timeout, 408, 429, 5xx                      |
| Fail-fast         | 4xx (except 408, 429)                                      |
| Rate limit        | 100 outbound admissions / minute / tenant                  |

Operator overrides: `MAX_DELIVERY_ATTEMPTS`, `DELIVERY_TIMEOUT_MS`, and `RATE_LIMIT_PER_MINUTE`.

> **Outbound rate limit:** When a tenant hits the cap, the worker defers until the next UTC minute plus a small jitter (logged as `rate_limited`).
>
> - That pause is not a failure.
> - It does not update `last_error`.
> - It does not count toward the five-attempt cap.
> - Admission is taken before the attempt is reserved, so a lost claim spends a rate-limit slot without sending or consuming an attempt.

### Attempt accounting

- The worker reserves the attempt number in the database **before** the HTTP call.
- A reserved attempt counts toward the cap, including one interrupted by a crash.
- If the process dies after reservation and before the request is sent, that slot is still consumed and no HTTP call was made.
- Attempt history stores only committed outcomes, so an interrupted attempt can leave a gap in the timeline.
- A pending row whose `next_retry_at` is still in the future is not claimed; an early queue job finishes without sending until the retry time is due.

### What counts as success

- A response counts as success only when it **finishes**.
- A stream error or a connection that closes before the body ends is a transport failure and follows the retry rules — even if some body bytes and a 2xx status already arrived.
- The receiver may already have processed the webhook, so the retry can deliver a duplicate.
- Response bodies stored on the attempt are truncated to about 1 KB.
- Timeouts stay timeouts.

> Delivery is at-least-once. Dedupe with `X-Webhook-Id` (stable across retries; see [Outbound](#outbound)). Ingest→queue durability is in [Outbox](#outbox).

### Sweeper

The sweeper (`SWEEP_INTERVAL_MS`, application default 5 minutes; production Compose default 30 seconds):

- Reclaims stale `in_progress` rows after the worker lease (delivery timeout + 30s).
- Re-enqueues due `pending` rows.
- Does **not** reset attempt counts.

### Manual replay

`POST /v1/deliveries/:id/replay` (or **Replay** on the delivery detail page).

| State                                      | Result                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `failed`                                   | `202` — new run; increments `replay_count`; resets attempt counter and `next_retry_at`; keeps previous attempts |
| `pending`                                  | `202` — re-enqueues the same run; attempt count, run number, and `next_retry_at` unchanged                  |
| `in_progress`                              | `400 invalid_state` — sweeper recovers after the lease; resetting could start a competing send              |
| succeeded, or endpoint disabled / removed  | `400 invalid_state`                                                                                         |

Notes:

- Attempts expose `run_number`, starting at 0.
- Delivery ID and `X-Webhook-Id` stay unchanged across replays.
- Each replay run is enqueued with queue deduplication id `delivery_id:replay_count`, so a new run is not confused with an older job for the same delivery.

## Configuration

The API and worker read their configuration from environment variables. The repository's `.env.example` lists local settings; the deployment guide contains production settings.

| Variable                       | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `DATABASE_URL`                 | PostgreSQL connection for the API and worker |
| `REDIS_URL`                    | Redis connection for queues and rate limits  |
| `ADMIN_BOOTSTRAP_SECRET`       | Authorizes the first account bootstrap       |
| `SESSION_SECRET`               | Signs session cookies                        |
| `CORS_ORIGIN`                  | Comma-separated browser origin allowlist     |
| `WEB_APP_URL`                  | Base URL for generated links                 |
| `INGEST_RATE_LIMIT_PER_MINUTE` | Ingest rate limit                            |
| `AUTH_RATE_LIMIT_PER_MINUTE`   | Authentication rate limit                    |
| `WORKER_CONCURRENCY`           | Concurrent delivery jobs                     |
| `MAX_DELIVERY_ATTEMPTS`        | Maximum delivery attempts                    |

Keep secrets private and use separate resources for development, tests and production.

## Deployment

The repository includes a Docker Compose deployment with an API, worker, PostgreSQL, Redis and Caddy. The deployment guide covers configuration, HTTPS, backups and upgrades. For a split deployment, browser session requests must use an allowed origin.

See the [deployment guide](https://github.com/0x4Nayan04/Hikyaku/blob/main/deploy/README.md) before exposing an installation to traffic.

## Testing

From the repository root:

| Command                 | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `pnpm lint`             | Lint                                                             |
| `pnpm typecheck`        | Typecheck                                                        |
| `pnpm test:unit`        | Unit tests                                                       |
| `pnpm build`            | Build workspace packages                                         |
| `pnpm test:integration` | Needs a dedicated test PostgreSQL database and Redis database    |
| `pnpm test:smoke`       | Playwright smoke tests                                           |

Follow the isolated setup in the [testing guide](https://github.com/0x4Nayan04/Hikyaku/blob/main/deploy/README.md#safe-tests). Never run service-backed tests against production data.

## Troubleshooting a delivery

| What you see                            | Check next                                                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No active endpoints, or `no_recipients` | Create or enable a receiver in **Endpoints** before sending. An event can exist without a delivery.                                                                                 |
| Event accepted, delivery stays pending  | Open the delivery timeline and check the worker and Redis. A delivery may be queued, waiting for a retry or rate-limited; an accepted event alone is not proof of receiver success. |
| `503 service_unavailable` after sending | Check Redis and the worker. The event may already be committed with outbox work awaiting recovery. Retry the same body and idempotency key rather than creating a new key blindly.  |
| Receiver reports a signature failure    | Use that endpoint's current signing secret and the timestamp and raw request body when verifying `X-Webhook-Signature`. Secrets are shown only when created or rotated.             |
| Endpoint is rejected in production      | Use a publicly resolvable HTTPS receiver. Loopback and private network destinations are blocked in production.                                                                      |
| A succeeded delivery cannot be replayed | Replay is available for failed or pending deliveries; `succeeded` and active `in_progress` deliveries return `invalid_state`.                                                       |

### Where to look next

- **Deliveries** page — status and attempt history.
- API and worker logs — distinguish a receiver failure from a queue or process outage.

For safe local tests, use a disposable PostgreSQL database ending in `_test` and a dedicated Redis instance with a database number greater than zero; configure the explicit test connection variables before running tests.

## Privacy

| Secret / data              | How it is handled                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| API keys                   | Stored as SHA-256 hashes; full secret shown only on create or rotate                                       |
| Endpoint signing secrets   | Kept server-side so the worker can sign outbound POSTs; shown once at create or rotate                     |
| Session cookies            | Power the console                                                                                          |
| Delivery attempt logs      | May include a truncated response body (~1KB) for debugging                                                 |
| Encryption at rest         | No application-level encryption beyond what your database and filesystem provide                           |

> **Protect secrets:** Do not commit API keys or signing secrets to source control or paste them into tickets. Revoke or rotate compromised credentials promptly ([API-only path](#api-only-path), Settings, **Rotate signing secret**, or the API routes above) and update receivers after endpoint secret rotation.

### URL safety

- Temporary DNS lookup failures use the normal bounded delivery retries.
- Private and loopback addresses are blocked when `NODE_ENV=production` and allowed outside production for local testing.
- Supported protocols, URL safety checks, and hostname resolution still apply in every environment.
- Endpoint registration rejects unresolved hostnames.

## Known limits

These are product boundaries, not defects. The same list lives in [SECURITY.md](https://github.com/0x4Nayan04/Hikyaku/blob/main/SECURITY.md) and `deploy/README.md`.

- Endpoint signing secrets are stored so the worker can sign POSTs; they are not hashed like API keys. Protect the database and backups.
- Signing-secret rotation replaces the secret immediately. There is no dual-secret window.
- Redis down: auth rate limits and ingest enqueue return **503**. The outbox can recover committed deliveries; login cannot.
- Invites and password resets are copy-paste links. There is no email delivery.
- HTTP delivery is **at-least-once**. Subscribers must dedupe on `X-Webhook-Id`.
