export type DocBadge = 'guide' | 'concept' | 'reference'

export type DocNavItem = {
  slug: string
  label: string
  description: string
  badge: DocBadge
  keywords?: string
}

export type DocNavGroup = {
  label: string
  items: DocNavItem[]
}

export const DOCS_NAV: DocNavGroup[] = [
  {
    label: 'Getting started',
    items: [
      {
        slug: 'introduction',
        label: 'Introduction',
        description: 'Ingest, fan-out, signing, and retries',
        badge: 'guide',
        keywords: 'ingest fanout signing retries how it works core concepts endpoint event delivery api key',
      },
      {
        slug: 'quick-start',
        label: 'Quick start',
        description: 'Bootstrap, create an endpoint, send a test event',
        badge: 'guide',
        keywords: 'bootstrap quick start setup test event curl ingest api keys endpoint webhook',
      },
      {
        slug: 'authentication',
        label: 'Authentication',
        description: 'API keys, sessions, signup, and invites',
        badge: 'guide',
        keywords: 'auth authentication api key bearer session cookie signup invite admin super admin',
      },
    ],
  },
  {
    label: 'Core concepts',
    items: [
      {
        slug: 'ingest',
        label: 'Ingest events',
        description: 'POST /v1/events, idempotency, and event status',
        badge: 'concept',
        keywords: 'ingest POST v1 events idempotency key event status pending failed completed payload type request body error 400 429',
      },
      {
        slug: 'api-keys',
        label: 'API keys',
        description: 'Create, revoke, and rotate tenant API keys',
        badge: 'concept',
        keywords: 'api key create revoke rotate bearer auth token secret management settings',
      },
      {
        slug: 'endpoints',
        label: 'Endpoints',
        description: 'Receiver URLs and signing secrets',
        badge: 'concept',
        keywords: 'endpoint receiver URL webhook signing secret create patch status description vault',
      },
      {
        slug: 'outbound',
        label: 'Outbound deliveries',
        description: 'Delivery body, headers, statuses, and inspection',
        badge: 'concept',
        keywords: 'deliver outbound POST HMAC signature headers X-Webhook-Id X-Webhook-Timestamp attempt retry pending in_progress succeeded failed deferred',
      },
      {
        slug: 'signing',
        label: 'HMAC signing',
        description: 'Verify X-Webhook-Signature on the receiver',
        badge: 'concept',
        keywords: 'HMAC SHA256 signing verify X-Webhook-Signature timestamp raw body secret node python',
      },
    ],
  },
  {
    label: 'Platform reference',
    items: [
      {
        slug: 'api-reference',
        label: 'API reference',
        description: 'Routes, auth rules, and pagination',
        badge: 'reference',
        keywords: 'API routes endpoints methods GET POST PATCH DELETE pagination limit offset auth bearer session',
      },
      {
        slug: 'retries',
        label: 'Retries & rate limits',
        description: 'Backoff, fail-fast, deferred deliveries, and replay',
        badge: 'reference',
        keywords: 'retry backoff exponential jitter rate limit 429 deferred replay failed delivery attempt',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        slug: 'console-guide',
        label: 'Console guide',
        description: 'Tenant pages and platform admin',
        badge: 'guide',
        keywords: 'console tenant dashboard admin settings vault password profile operations',
      },
      {
        slug: 'privacy',
        label: 'Privacy & data',
        description: 'What is hashed, shown once, and logged',
        badge: 'reference',
        keywords: 'privacy data hash SHA-256 secret encrypted stored session memory logged security',
      },
    ],
  },
]

export const DOCS_FLAT = DOCS_NAV.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupLabel: group.label })),
)

export function docPath(slug: string): string {
  return `/docs/${slug}`
}

export function findDocItem(slug: string): (DocNavItem & { groupLabel: string }) | undefined {
  return DOCS_FLAT.find((item) => item.slug === slug)
}

export function adjacentDocs(slug: string): {
  previous: (typeof DOCS_FLAT)[number] | null
  next: (typeof DOCS_FLAT)[number] | null
} {
  const index = DOCS_FLAT.findIndex((item) => item.slug === slug)
  if (index < 0) return { previous: null, next: null }
  return {
    previous: index > 0 ? DOCS_FLAT[index - 1] : null,
    next: index < DOCS_FLAT.length - 1 ? DOCS_FLAT[index + 1] : null,
  }
}
