import { readFileSync } from 'node:fs'
import {
  Children,
  createElement,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import http from 'highlight.js/lib/languages/http'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import { loadEnv, type Plugin } from 'vite'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('http', http)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)

const APP_NAME = 'Hikyaku'

export type DocsSearchEntry = {
  id: string
  label: string
}

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

function MarkdownCodeBlock({ children, ...props }: ComponentProps<'pre'> & { node?: unknown }) {
  const { node: _node, ...preProps } = props
  const code = textContent(children).replace(/\n$/, '')
  const lang = codeLanguage(children)
  const canHighlight = Boolean(lang && hljs.getLanguage(lang))
  const highlighted = canHighlight ? hljs.highlight(code, { language: lang }).value : null

  return createElement(
    'div',
    { className: 'docs-code', 'data-lang': lang || undefined },
    createElement(
      'div',
      { className: 'docs-code-toolbar' },
      createElement('span', { className: 'docs-code-lang' }, lang || 'code'),
      createElement(
        'button',
        { type: 'button', className: 'docs-code-copy focus-ring', 'aria-label': 'Copy code' },
        'Copy',
      ),
    ),
    createElement(
      'pre',
      { className: 'docs-code-body', ...preProps },
      highlighted
        ? createElement('code', {
            className: `hljs language-${lang}`,
            dangerouslySetInnerHTML: { __html: highlighted },
          })
        : children,
    ),
  )
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node: _node, children, ...props }) =>
    createElement('h1', { className: 'docs-title', ...props }, children),
  h2: ({ node: _node, children, ...props }) =>
    createElement('h2', { id: headingId(children), className: 'docs-h2', ...props }, children),
  h3: ({ node: _node, children, ...props }) =>
    createElement('h3', { id: headingId(children), className: 'docs-h3', ...props }, children),
  p: ({ node: _node, ...props }) => createElement('p', { className: 'docs-prose', ...props }),
  ul: ({ node: _node, ...props }) => createElement('ul', { className: 'docs-list', ...props }),
  ol: ({ node: _node, ...props }) =>
    createElement('ol', { className: 'docs-ordered-list', ...props }),
  a: ({ node: _node, href = '', children, ...props }) =>
    href.startsWith('/')
      ? createElement('a', { href }, children)
      : createElement(
          'a',
          {
            href,
            target: href.startsWith('#') ? undefined : '_blank',
            rel: href.startsWith('#') ? undefined : 'noreferrer',
            ...props,
          },
          children,
        ),
  table: ({ node: _node, ...props }) =>
    createElement(
      'div',
      { className: 'docs-table-wrap' },
      createElement('table', { className: 'docs-table', ...props }),
    ),
  pre: MarkdownCodeBlock,
  blockquote: ({ node: _node, children, ...props }) =>
    createElement('blockquote', { className: 'docs-callout', ...props }, children),
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildSearchIndex(source: string): DocsSearchEntry[] {
  const entries: DocsSearchEntry[] = []
  const seen = new Set<string>()

  for (const line of source.split('\n')) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line)
    if (!match) continue
    const label = match[2].trim()
    const id = slugify(label)
    if (!id || seen.has(id)) continue
    seen.add(id)
    entries.push({ id, label })
  }

  return entries
}

function renderGuideHtml(source: string): string {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      { remarkPlugins: [remarkGfm], components: MARKDOWN_COMPONENTS },
      source,
    ),
  )
}

function parseId(id: string): { filename: string; query: string } {
  const clean = id.split('\0')[0] ?? id
  const qIndex = clean.indexOf('?')
  if (qIndex === -1) return { filename: clean, query: '' }
  return { filename: clean.slice(0, qIndex), query: clean.slice(qIndex + 1) }
}

export function compileDocsGuide(): Plugin {
  let apiBase = 'http://localhost:3000'

  return {
    name: 'compile-docs-guide',
    enforce: 'pre',
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir ?? config.root, '')
      apiBase = env.VITE_API_URL ?? apiBase
    },
    load(id) {
      const { filename, query } = parseId(id)
      if (!filename.endsWith('guide.md')) return
      if (query !== 'html' && query !== 'search') return

      const source = readFileSync(filename, 'utf8')
        .replaceAll('{{APP_NAME}}', APP_NAME)
        .replaceAll('{{API_BASE}}', apiBase)

      if (query === 'html') {
        return `export default ${JSON.stringify(renderGuideHtml(source))}`
      }
      return `export default ${JSON.stringify(buildSearchIndex(source))}`
    },
  }
}
