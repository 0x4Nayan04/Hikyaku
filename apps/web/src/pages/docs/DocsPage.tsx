import { Children, isValidElement, useState, type ComponentProps, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { Link } from 'react-router-dom'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import http from 'highlight.js/lib/languages/http'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'

import { API_BASE } from '@/api/client'
import guide from '@/docs/guide.md?raw'
import { APP_NAME } from '@/lib/app-meta'
import { copyToClipboard } from '@/lib/clipboard'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('http', http)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)

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

function codeLanguage(children: ReactNode): string {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ className?: string }>(child)) continue
    const match = /language-([\w-]+)/.exec(child.props.className ?? '')
    if (match?.[1]) return match[1]
  }
  return ''
}

type MarkdownCodeBlockProps = ComponentProps<'pre'> & { node?: unknown }

function MarkdownCodeBlock({ node: _node, children, ...props }: MarkdownCodeBlockProps) {
  const code = textContent(children).replace(/\n$/, '')
  const lang = codeLanguage(children)
  const canHighlight = Boolean(lang && hljs.getLanguage(lang))
  const highlighted = canHighlight ? hljs.highlight(code, { language: lang }).value : null
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await copyToClipboard(code, 'Code')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="docs-code" data-lang={lang || undefined}>
      <div className="docs-code-toolbar">
        <span className="docs-code-lang">{lang || 'code'}</span>
        <button
          type="button"
          className="docs-code-copy focus-ring"
          onClick={() => void handleCopy()}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="docs-code-body" {...props}>
        {highlighted ? (
          <code className={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
        ) : (
          children
        )}
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
