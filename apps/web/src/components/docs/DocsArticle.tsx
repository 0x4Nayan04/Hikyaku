import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { DocsOnPageNav } from '@/components/docs/DocsOnPageNav'
import { DocsPager } from '@/components/docs/DocsPager'
import { adjacentDocs } from '@/docs/config'
import type { DocTocItem } from '@/docs/types'

type DocsArticleProps = {
  slug: string
  title: string
  description: string
  toc?: DocTocItem[]
  children: ReactNode
}

export function DocsArticle({ slug, title, description, toc = [], children }: DocsArticleProps) {
  const { previous, next } = adjacentDocs(slug)

  return (
    <div className="docs-v2-article-layout">
      <article className="docs-v2-article">
        <header className="docs-v2-article-header">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/docs">Docs</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="docs-v2-article-title">{title}</h1>
          <p className="docs-v2-article-lead">{description}</p>
        </header>

        <div className="docs-v2-article-body">{children}</div>

      </article>

      <DocsOnPageNav items={toc} />

      <DocsPager
        previous={previous ? { slug: previous.slug, label: previous.label } : null}
        next={next ? { slug: next.slug, label: next.label } : null}
      />
    </div>
  )
}
