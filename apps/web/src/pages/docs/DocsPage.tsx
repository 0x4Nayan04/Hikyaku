import { Children, isValidElement, type ComponentProps, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { Link } from 'react-router-dom'
import remarkGfm from 'remark-gfm'

import { API_BASE } from '@/api/client'
import guide from '@/docs/guide.md?raw'
import { APP_NAME } from '@/lib/app-meta'
import { copyToClipboard } from '@/lib/clipboard'

function headingId(children: ReactNode): string {
  return Children.toArray(children)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (isValidElement<{ children?: ReactNode }>(node)) return textContent(node.props.children)
  return Children.toArray(node).map(textContent).join('')
}

type MarkdownCodeBlockProps = ComponentProps<'pre'> & { node?: unknown }

function MarkdownCodeBlock({ node: _node, children, ...props }: MarkdownCodeBlockProps) {
  const code = textContent(children).replace(/\n$/, '')

  return (
    <div className="docs-code">
      <button
        type="button"
        className="docs-code-copy focus-ring"
        onClick={() => void copyToClipboard(code, 'Code')}
      >
        Copy
      </button>
      <pre className="docs-code-body" {...props}>
        {children}
      </pre>
    </div>
  )
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node: _node, children, ...props }) => (
    <h1 className="docs-title" {...props}>
      {children}
    </h1>
  ),
  h2: ({ node: _node, children, ...props }) => (
    <h2 id={headingId(children)} className="docs-h2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ node: _node, children, ...props }) => (
    <h3 id={headingId(children)} className="docs-h3" {...props}>
      {children}
    </h3>
  ),
  p: ({ node: _node, ...props }) => <p className="docs-prose" {...props} />,
  ul: ({ node: _node, ...props }) => <ul className="docs-list" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="docs-ordered-list" {...props} />,
  a: ({ node: _node, href = '', children, ...props }) =>
    href.startsWith('/') ? (
      <Link to={href}>{children}</Link>
    ) : (
      <a
        href={href}
        target={href.startsWith('#') ? undefined : '_blank'}
        rel={href.startsWith('#') ? undefined : 'noreferrer'}
        {...props}
      >
        {children}
      </a>
    ),
  table: ({ node: _node, ...props }) => (
    <div className="docs-table-wrap">
      <table className="docs-table" {...props} />
    </div>
  ),
  pre: MarkdownCodeBlock,
  blockquote: ({ node: _node, children, ...props }) => (
    <blockquote className="docs-callout" {...props}>
      {children}
    </blockquote>
  ),
}

const content = guide.replaceAll('{{APP_NAME}}', APP_NAME).replaceAll('{{API_BASE}}', API_BASE)

export function DocsPage() {
  return (
    <article className="docs-article">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {content}
      </ReactMarkdown>
    </article>
  )
}
