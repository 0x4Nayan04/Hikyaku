/**
 * One entry per docs page. `sections` lists the guide's h2 anchors that the
 * page contains; the build splits the single guide.md source at h2 boundaries
 * (see vite-plugin-docs-guide.ts) and validates this plan against the source.
 */
export type DocsPage = {
  slug: string
  title: string
  sections: readonly string[]
  /**
   * h3 anchors that live on this page. They mirror guide.md's h3 heading ids
   * so legacy `/docs#anchor` links can still find their page.
   */
  anchors?: readonly string[]
}

export const DOCS_PAGES: readonly DocsPage[] = [
  { slug: 'introduction', title: 'Introduction', sections: ['start-here', 'introduction'] },
  { slug: 'quick-start', title: 'Quick start', sections: ['quick-start'], anchors: ['api-only-path', 'console-path'] },
  { slug: 'console-guide', title: 'Console guide', sections: ['console-guide'] },
  { slug: 'inside-hikyaku', title: 'Inside Hikyaku', sections: ['inside-hikyaku'] },
  {
    slug: 'find-your-way-around-the-code',
    title: 'Find your way around the code',
    sections: ['find-your-way-around-the-code'],
  },
  { slug: 'authentication', title: 'Authentication', sections: ['authentication'] },
  { slug: 'ingest', title: 'Ingest', sections: ['ingest'] },
  { slug: 'api-keys', title: 'API keys', sections: ['api-keys'] },
  { slug: 'endpoints', title: 'Endpoints', sections: ['endpoints'] },
  { slug: 'outbound', title: 'Outbound', sections: ['outbound'] },
  { slug: 'signing', title: 'Signing', sections: ['signing'], anchors: ['node-js', 'python'] },
  { slug: 'outbox', title: 'Outbox', sections: ['outbox'] },
  { slug: 'api-reference', title: 'API reference', sections: ['api-reference'] },
  { slug: 'retries', title: 'Retries', sections: ['retries'] },
  { slug: 'configuration', title: 'Configuration', sections: ['configuration'] },
  { slug: 'deployment', title: 'Deployment', sections: ['deployment'] },
  { slug: 'testing', title: 'Testing', sections: ['testing'] },
  {
    slug: 'troubleshooting-a-delivery',
    title: 'Troubleshooting a delivery',
    sections: ['troubleshooting-a-delivery'],
  },
  { slug: 'privacy', title: 'Privacy', sections: ['privacy'] },
  { slug: 'known-limits', title: 'Known limits', sections: ['known-limits'] },
]

export function docsPageBySlug(slug: string): DocsPage | null {
  return DOCS_PAGES.find((page) => page.slug === slug) ?? null
}

/**
 * Old `/docs#anchor` links point at the page that owns the anchor. A page's
 * namesake heading becomes the clean page URL; every other anchor keeps an
 * in-page hash on its page.
 */
export function docsPathForAnchor(anchor: string): string | null {
  for (const page of DOCS_PAGES) {
    if (page.sections.includes(anchor)) {
      return anchor === page.slug ? `/docs/${page.slug}` : `/docs/${page.slug}#${anchor}`
    }
    if (page.anchors?.includes(anchor)) {
      return `/docs/${page.slug}#${anchor}`
    }
  }
  return null
}
