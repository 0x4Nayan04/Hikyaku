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
        description: 'How events move from ingest to signed delivery',
        badge: 'guide',
      },
      {
        slug: 'quick-start',
        label: 'Quick start',
        description: 'Send your first webhook in a few minutes',
        badge: 'guide',
      },
      {
        slug: 'authentication',
        label: 'Authentication',
        description: 'API keys, console sessions, and how teams get access',
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
        description: 'Accept events once, fan them out safely',
        badge: 'concept',
      },
      {
        slug: 'api-keys',
        label: 'API keys',
        description: 'Create and rotate keys for backend ingest',
        badge: 'concept',
      },
      {
        slug: 'endpoints',
        label: 'Endpoints',
        description: 'Register subscriber URLs and signing secrets',
        badge: 'concept',
      },
      {
        slug: 'outbound',
        label: 'Outbound deliveries',
        description: 'What subscribers receive and how to track it',
        badge: 'concept',
      },
      {
        slug: 'signing',
        label: 'HMAC signing',
        description: 'Verify that a webhook really came from you',
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
        description: 'How failed deliveries recover — and when they stop',
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
        description: 'Operate day-to-day from the browser',
        badge: 'guide',
      },
      {
        slug: 'privacy',
        label: 'Privacy & data',
        description: 'What we store, hash, and show once',
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
