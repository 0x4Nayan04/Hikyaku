import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

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
})
