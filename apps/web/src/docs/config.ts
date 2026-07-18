export type DocBadge = 'guide' | 'concept' | 'reference'

export type DocNavItem = {
  slug: string
  label: string
  description: string
  badge: DocBadge
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
      },
      {
        slug: 'quick-start',
        label: 'Quick start',
        description: 'Bootstrap, create an endpoint, send a test event',
        badge: 'guide',
      },
      {
        slug: 'authentication',
        label: 'Authentication',
        description: 'API keys, sessions, signup, and invites',
        badge: 'guide',
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
      },
      {
        slug: 'api-keys',
        label: 'API keys',
        description: 'Create, revoke, and rotate tenant API keys',
        badge: 'concept',
      },
      {
        slug: 'endpoints',
        label: 'Endpoints',
        description: 'Receiver URLs and signing secrets',
        badge: 'concept',
      },
      {
        slug: 'outbound',
        label: 'Outbound deliveries',
        description: 'Delivery body, headers, statuses, and inspection',
        badge: 'concept',
      },
      {
        slug: 'signing',
        label: 'HMAC signing',
        description: 'Verify X-Webhook-Signature on the receiver',
        badge: 'concept',
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
      },
      {
        slug: 'retries',
        label: 'Retries & rate limits',
        description: 'Backoff, fail-fast, deferred deliveries, and replay',
        badge: 'reference',
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
      },
      {
        slug: 'privacy',
        label: 'Privacy & data',
        description: 'What is hashed, shown once, and logged',
        badge: 'reference',
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
