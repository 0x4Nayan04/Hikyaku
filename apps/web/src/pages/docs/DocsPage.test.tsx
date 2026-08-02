import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { DOCS_TOC } from '@/docs/toc'
import { DocsPage } from '@/pages/docs/DocsPage'

describe('DocsPage', () => {
  it('renders every TOC section heading', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/docs']}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    for (const item of DOCS_TOC) {
      expect(html).toContain(`id="${item.id}"`)
      expect(html).toContain(item.label)
    }
  })
})
