import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { DOCS_PAGES, docsPageBySlug } from '@/docs/toc'

type PagerTarget = {
  slug: string
  title: string
}

export function DocsPager({ slug }: { slug: string }) {
  const page = docsPageBySlug(slug)
  if (!page) return null

  const index = DOCS_PAGES.indexOf(page)
  const previous: PagerTarget | null = index > 0 ? DOCS_PAGES[index - 1] : null
  const next: PagerTarget | null = index < DOCS_PAGES.length - 1 ? DOCS_PAGES[index + 1] : null
  if (!previous && !next) return null

  return (
    <nav className="docs-pager" aria-label="Docs pagination">
      {previous ? (
        <Link
          to={`/docs/${previous.slug}`}
          rel="prev"
          className="docs-pager__link docs-pager__link--prev focus-ring"
        >
          <ArrowLeft className="docs-pager__arrow" aria-hidden="true" />
          <span className="docs-pager__text">
            <span className="docs-pager__label">Previous</span>
            <span className="docs-pager__title">{previous.title}</span>
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      {next ? (
        <Link
          to={`/docs/${next.slug}`}
          rel="next"
          className="docs-pager__link docs-pager__link--next focus-ring"
        >
          <span className="docs-pager__text">
            <span className="docs-pager__label">Next</span>
            <span className="docs-pager__title">{next.title}</span>
          </span>
          <ArrowRight className="docs-pager__arrow" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  )
}
