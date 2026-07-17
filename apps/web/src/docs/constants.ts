export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const INGEST_CURL = `curl -X POST "${API_BASE}/v1/events" \\
  -H "Authorization: Bearer whk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "idempotency_key": "order-123-paid",
    "type": "order.paid",
    "payload": { "order_id": "123", "amount": 4999 }
  }'`

export const INGEST_RESPONSE = `{
  "id": "evt_uuid",
  "status": "pending",
  "created_at": "2026-06-05T12:00:00Z"
}`

export const CREATE_ENDPOINT_CURL = `curl -X POST "${API_BASE}/v1/endpoints" \\
  -H "Authorization: Bearer whk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com/webhooks",
    "description": "Production orders handler"
  }'`

export const CREATE_API_KEY_CURL = `curl -X POST "${API_BASE}/v1/api-keys" \\
  -H "Authorization: Bearer whk_your_api_key" \\
  -H "Content-Type: application/json"`

export const OUTBOUND_BODY = `{
  "id": "evt_uuid",
  "type": "order.paid",
  "created_at": "2026-06-05T12:00:00Z",
  "data": { "order_id": "123", "amount": 4999 }
}`

export const VERIFY_NODE = `import crypto from 'node:crypto'

function verifyWebhook(rawBody, signatureHeader, timestamp, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex')

  const received = signatureHeader.replace(/^sha256=/, '')
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(received, 'hex'),
  )
}`

export const VERIFY_PYTHON = `import hashlib
import hmac

def verify_webhook(raw_body: bytes, signature_header: str, timestamp: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.".encode("utf-8") + raw_body,
        hashlib.sha256,
    ).hexdigest()
    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)`

export type ApiRoute = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  purpose: string
}

export const API_ROUTES: ApiRoute[] = [
  { method: 'GET', path: '/v1/health', purpose: 'Liveness probe' },
  { method: 'GET', path: '/v1/ready', purpose: 'Postgres + Redis connectivity' },
  { method: 'POST', path: '/v1/auth/bootstrap', purpose: 'One-time super-admin bootstrap' },
  { method: 'POST', path: '/v1/auth/signup', purpose: 'Request tenant access (pending approval)' },
  { method: 'GET', path: '/v1/auth/invites/validate', purpose: 'Validate invite token' },
  { method: 'POST', path: '/v1/auth/accept-invite', purpose: 'Accept invite and create account' },
  { method: 'POST', path: '/v1/auth/login', purpose: 'Email/password login → session cookie' },
  { method: 'POST', path: '/v1/auth/logout', purpose: 'End session' },
  { method: 'GET', path: '/v1/auth/me', purpose: 'Current user + tenant' },
  { method: 'POST', path: '/v1/auth/change-password', purpose: 'Change password (session)' },
  { method: 'GET', path: '/v1/stats', purpose: 'Dashboard metrics (tenant auth)' },
  { method: 'GET', path: '/v1/api-keys', purpose: 'List API keys (prefix only)' },
  { method: 'POST', path: '/v1/api-keys', purpose: 'Create API key (shown once)' },
  { method: 'POST', path: '/v1/api-keys/:id/revoke', purpose: 'Revoke API key' },
  { method: 'POST', path: '/v1/api-keys/:id/rotate', purpose: 'Rotate API key (new key shown once)' },
  { method: 'POST', path: '/v1/endpoints', purpose: 'Create endpoint (secret shown once)' },
  { method: 'GET', path: '/v1/endpoints', purpose: 'List endpoints' },
  { method: 'PATCH', path: '/v1/endpoints/:id', purpose: 'Update status or description' },
  { method: 'POST', path: '/v1/events', purpose: 'Ingest event → 202 Accepted' },
  { method: 'GET', path: '/v1/events', purpose: 'List events (paginated)' },
  { method: 'GET', path: '/v1/events/:id', purpose: 'Event detail + delivery summary' },
  { method: 'GET', path: '/v1/deliveries/stream', purpose: 'SSE live delivery updates (session only)' },
  { method: 'GET', path: '/v1/deliveries', purpose: 'List deliveries' },
  { method: 'GET', path: '/v1/deliveries/:id', purpose: 'Delivery + attempt timeline' },
  { method: 'POST', path: '/v1/deliveries/:id/replay', purpose: 'Replay failed delivery → 202' },
  { method: 'GET', path: '/v1/admin/tenants', purpose: 'List tenants (super-admin)' },
  { method: 'POST', path: '/v1/admin/tenants', purpose: 'Create tenant with owner credentials' },
  { method: 'GET', path: '/v1/admin/tenants/:id', purpose: 'Get tenant detail' },
  { method: 'PATCH', path: '/v1/admin/tenants/:id', purpose: 'Rename tenant' },
  { method: 'DELETE', path: '/v1/admin/tenants/:id', purpose: 'Delete tenant' },
  { method: 'GET', path: '/v1/admin/tenants/:id/users', purpose: 'List users in a tenant' },
  { method: 'POST', path: '/v1/admin/tenants/:id/users', purpose: 'Create a user in a tenant' },
  { method: 'POST', path: '/v1/admin/invites', purpose: 'Create tenant-owner or user invite' },
  { method: 'GET', path: '/v1/admin/operators', purpose: 'List platform operators (super-admin)' },
  { method: 'POST', path: '/v1/admin/operators/invites', purpose: 'Invite a platform operator' },
  { method: 'DELETE', path: '/v1/admin/operators/:id', purpose: 'Remove a platform operator' },
  { method: 'GET', path: '/v1/admin/signup-requests', purpose: 'List pending signup requests' },
  { method: 'POST', path: '/v1/admin/signup-requests/:id/approve', purpose: 'Approve signup request' },
  { method: 'POST', path: '/v1/admin/signup-requests/:id/reject', purpose: 'Reject signup request' },
  { method: 'GET', path: '/v1/admin/audit-log', purpose: 'Platform audit log' },
]
