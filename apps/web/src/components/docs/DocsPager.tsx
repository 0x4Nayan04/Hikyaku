import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { docPath } from '@/docs/config'
import { cn } from '@/lib/utils'

type DocsPagerProps = {
  previous: { slug: string; label: string } | null
  next: { slug: string; label: string } | null
}

export function DocsPager({ previous, next }: DocsPagerProps) {
  if (!previous && !next) return null

  return (
    <nav
      className={cn(
        'docs-v2-pager',
        previous && !next && 'docs-v2-pager--prev-only',
        !previous && next && 'docs-v2-pager--next-only',
      )}
      aria-label="Adjacent documentation"
    >
      {previous ? (
        <Link to={docPath(previous.slug)} className="docs-v2-pager-link docs-v2-pager-link--prev">
          <span className="docs-v2-pager-kicker">
            <ArrowLeft size={14} aria-hidden="true" />
            Previous
          </span>
          <span className="docs-v2-pager-title">{previous.label}</span>
        </Link>
      ) : null}
      {next ? (
        <Link to={docPath(next.slug)} className="docs-v2-pager-link docs-v2-pager-link--next">
          <span className="docs-v2-pager-kicker">
            Next
            <ArrowRight size={14} aria-hidden="true" />
          </span>
          <span className="docs-v2-pager-title">{next.label}</span>
        </Link>
      ) : null}
    </nav>
  )
}
