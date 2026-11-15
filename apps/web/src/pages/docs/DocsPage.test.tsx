import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { compileDocsGuide } from '../../../vite-plugin-docs-guide'

import pageHtmlMap from '@/docs/guide.md?pages'
import { DocsPager } from '@/components/docs/DocsPager'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { DOCS_PAGES } from '@/docs/toc'
import { DocsPage } from '@/pages/docs/DocsPage'

function renderPage(slug: string): string {
  return pageHtmlMap[slug] ?? ''
}

describe('DocsPage', () => {
  it('groups desktop navigation while linking every docs page', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/docs/quick-start']}>
        <DocsSidebar activeSlug="quick-start" />
      </MemoryRouter>,
    )

    for (const label of [
      'Getting started',
      'Concepts and architecture',
      'Reference',
      'Operations',
    ]) {
      expect(html).toContain(label)
    }
    for (const page of DOCS_PAGES) {
      expect(html).toContain(page.title)
      expect(html).toContain(`href="/docs/${page.slug}"`)
    }
    expect(html).toMatch(/aria-current="page"[^>]*href="\/docs\/quick-start"/)
  })

  it('renders one page per slug with a unique heading id on every page', () => {
    for (const page of DOCS_PAGES) {
      const html = renderPage(page.slug)
      expect(html.length).toBeGreaterThan(0)
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
      expect(new Set(ids).size).toBe(ids.length)
      if (page.slug !== 'introduction') {
        expect(html).toMatch(new RegExp(`<h1\\b[^>]*id="${page.slug}"[^>]*class="docs-title"`))
      }
    }
  })

  it('keeps Start here with its card grid on the introduction page', () => {
    const html = renderPage('introduction')

    expect(html).toMatch(/<h1\b[^>]*class="docs-title"/)
    expect(html).toMatch(/<h2\b[^>]*id="start-here"/)
    expect(html).toMatch(/<h2\b[^>]*id="introduction"/)
  })

  it('resolves every in-guide link to the page that owns its anchor', () => {
    for (const page of DOCS_PAGES) {
      const html = renderPage(page.slug)
      expect(html).not.toMatch(/href="#/)
      for (const match of html.matchAll(/href="(\/docs\/[^"]*)"/g)) {
        const href = match[1]
        const [path, anchor] = href.split('#')
        const slug = path.replace('/docs/', '')
        const target = pageHtmlMap[slug]
        expect(target, `${href} on ${page.slug} has a target page`).toBeTruthy()
        if (anchor) {
          expect(target).toContain(`id="${anchor}"`)
        }
      }
    }
  })

  it('renders the requested page slug through the router', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/docs/quick-start']}>
        <Routes>
          <Route path="/docs/:slug" element={<DocsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(html).toMatch(/<article[^>]*class="docs-article"/)
    expect(html).toMatch(/<h1\b[^>]*id="quick-start"/)
  })

  it('makes code examples and wide tables keyboard reachable and labeled', () => {
    const html = renderPage('quick-start')

    expect(html).toMatch(
      /<pre[^>]*role="group"[^>]*aria-label="(?:bash|http|json|javascript|python) example"[^>]*tabindex="0"/,
    )
    expect(html).toContain(
      'class="docs-table-wrap" role="group" aria-label="Scrollable documentation table" tabindex="0"',
    )
    expect(html).toContain('class="docs-code-copy focus-ring" aria-label="Copy code"')
  })

  it('pages Previous and Next in reading order with no links past the ends', () => {
    const first = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/docs']}>
        <DocsPager slug={DOCS_PAGES[0].slug} />
      </MemoryRouter>,
    )
    expect(first).toContain('rel="next"')
    expect(first).not.toContain('rel="prev"')

    const middle = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/docs']}>
        <DocsPager slug="api-reference" />
      </MemoryRouter>,
    )
    expect(middle).toContain('rel="prev"')
    expect(middle).toContain('rel="next"')
    expect(middle).toContain('Outbox')
    expect(middle).toContain('Retries')

    const last = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/docs']}>
        <DocsPager slug={DOCS_PAGES[DOCS_PAGES.length - 1].slug} />
      </MemoryRouter>,
    )
    expect(last).toContain('rel="prev"')
    expect(last).not.toContain('rel="next"')
  })

  it('keeps API examples local even when a public API URL is configured', () => {
    const previous = process.env.VITE_PUBLIC_API_URL
    const plugin = compileDocsGuide()
    const configResolved = plugin.configResolved as (config: never) => void
    const load = plugin.load as (this: unknown, id: string) => string | undefined
    const guidePath = new URL('../../docs/guide.md', import.meta.url).pathname

    try {
      process.env.VITE_PUBLIC_API_URL = 'https://private-api.example.test'
      configResolved({ mode: 'test', envDir: '/tmp/no-docs-env', root: process.cwd() } as never)
      for (const query of ['html', 'search', 'pages', 'page-search']) {
        const output = load.call({}, `${guidePath}?${query}`)
        expect(output).toContain('http://localhost:3000')
        expect(output).not.toContain('https://private-api.example.test')
      }
    } finally {
      if (previous === undefined) delete process.env.VITE_PUBLIC_API_URL
      else process.env.VITE_PUBLIC_API_URL = previous
    }
  })

  it('keeps website examples local regardless of deployment configuration', () => {
    const previous = process.env.VITE_PUBLIC_SITE_URL
    const plugin = compileDocsGuide()
    const configResolved = plugin.configResolved as (config: never) => void
    const load = plugin.load as (this: unknown, id: string) => string | undefined
    const guidePath = new URL('../../docs/guide.md', import.meta.url).pathname

    try {
      process.env.VITE_PUBLIC_SITE_URL = 'https://console.example.test/some/path/'
      configResolved({ mode: 'test', envDir: process.cwd(), root: process.cwd() } as never)
      const hosted = load.call({}, `${guidePath}?pages`)
      expect(hosted).toContain('Origin: http://localhost:5173')
      expect(hosted).not.toContain('https://console.example.test')
      expect(hosted).not.toContain('{{WEB_ORIGIN}}')

      delete process.env.VITE_PUBLIC_SITE_URL
      configResolved({ mode: 'test', envDir: '/tmp/no-docs-env', root: process.cwd() } as never)
      const local = load.call({}, `${guidePath}?pages`)
      expect(local).toContain('Origin: http://localhost:5173')
      expect(local).not.toContain('{{WEB_ORIGIN}}')
    } finally {
      if (previous === undefined) delete process.env.VITE_PUBLIC_SITE_URL
      else process.env.VITE_PUBLIC_SITE_URL = previous
    }
  })
})
