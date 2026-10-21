export const DOCS_TOC = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'quick-start', label: 'Quick start' },
  { id: 'api-only-path', label: 'Terminal walkthrough' },
  { id: 'console-path', label: 'Website walkthrough' },
  { id: 'console-guide', label: 'Console guide' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'ingest', label: 'Ingest' },
  { id: 'api-keys', label: 'API keys' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'outbound', label: 'Outbound' },
  { id: 'signing', label: 'Signing' },
  { id: 'outbox', label: 'Outbox' },
  { id: 'api-reference', label: 'API reference' },
  { id: 'retries', label: 'Retries' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'known-limits', label: 'Known limits' },
] as const

const LEGACY_SLUGS = new Set<string>(DOCS_TOC.map((item) => item.id))

/** Old multi-page slugs → section anchors on the single docs page. */
export function legacyDocsHash(slug: string): string | null {
  return LEGACY_SLUGS.has(slug) ? `#${slug}` : null
}
