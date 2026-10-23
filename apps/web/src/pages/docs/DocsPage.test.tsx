import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { compileDocsGuide } from '../../../vite-plugin-docs-guide'

import { DOCS_TOC } from '@/docs/toc'
import { DocsPage } from '@/pages/docs/DocsPage'

describe('DocsPage', () => {
  it('renders every TOC target, and top-level section labels match h2 copy', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/docs']}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const h2InnerById = new Map(
      [...html.matchAll(/<h2\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((match) => [
        match[1],
        match[2].replace(/<[^>]+>/g, ''),
      ]),
    )

    for (const item of DOCS_TOC) {
      expect(html).toContain(`id="${item.id}"`)
      const heading = h2InnerById.get(item.id)
      if (heading === undefined) continue
      expect(heading).toContain(item.label)
    }
  })

  it('keeps Start here as a top-level heading with its existing anchor', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/docs']}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(html).toMatch(/<h2\b[^>]*id="start-here"/)
  })

  it('makes code examples and wide tables keyboard reachable and labeled', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/docs']}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(html).toMatch(
      /<pre[^>]*role="group"[^>]*aria-label="(?:bash|http|json|javascript|python) example"[^>]*tabindex="0"/,
    )
    expect(html).toContain(
      'class="docs-table-wrap" role="group" aria-label="Scrollable documentation table" tabindex="0"',
    )
    expect(html).toContain('class="docs-code-copy focus-ring" aria-label="Copy code"')
  })

  it('substitutes configured website origins and defaults locally', () => {
    const previous = process.env.VITE_PUBLIC_SITE_URL
    const plugin = compileDocsGuide()
    const configResolved = plugin.configResolved as (config: never) => void
    const load = plugin.load as (this: unknown, id: string) => string | undefined
    const guidePath = new URL('../../docs/guide.md', import.meta.url).pathname

    try {
      process.env.VITE_PUBLIC_SITE_URL = 'https://console.example.test/some/path/'
      configResolved({ mode: 'test', envDir: process.cwd(), root: process.cwd() } as never)
      const hosted = load.call({}, `${guidePath}?html`)
      expect(hosted).toContain('Origin: https://console.example.test')
      expect(hosted).not.toContain('{{WEB_ORIGIN}}')

      delete process.env.VITE_PUBLIC_SITE_URL
      configResolved({ mode: 'test', envDir: '/tmp/no-docs-env', root: process.cwd() } as never)
      const local = load.call({}, `${guidePath}?html`)
      expect(local).toContain('Origin: http://localhost:5173')
      expect(local).not.toContain('{{WEB_ORIGIN}}')
    } finally {
      if (previous === undefined) delete process.env.VITE_PUBLIC_SITE_URL
      else process.env.VITE_PUBLIC_SITE_URL = previous
    }
  })
})
