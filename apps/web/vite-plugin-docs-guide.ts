import { readFileSync } from 'node:fs'
import { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from 'react'
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
import { DOCS_PAGES } from './src/docs/toc'
import { normalizeSiteUrl } from './src/lib/meta/public-site-meta'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('http', http)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)

const APP_NAME = 'Hikyaku'

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.length > 0)
}

export type DocsSearchEntry = {
  id: string
  label: string
  text: string
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
      {
        ...preProps,
        className: 'docs-code-body',
        role: 'group',
        'aria-label': `${lang || 'Code'} example`,
        tabIndex: 0,
      },
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
      {
        className: 'docs-table-wrap',
        role: 'group',
        'aria-label': 'Scrollable documentation table',
        tabIndex: 0,
      },
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

function plainText(markdown: string): string {
  return (
    markdown
      .replace(/```[\w-]*/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Keep "_" so snake_case names such as replay_count stay searchable.
      .replace(/[*~]/g, '')
      .replace(/[>#|]/g, ' ')
      .replace(/^\s*[-+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function buildSearchIndex(source: string): DocsSearchEntry[] {
  const entries: DocsSearchEntry[] = []
  const seen = new Set<string>()
  let current: { id: string; label: string; lines: string[] } | null = null

  const flush = () => {
    const section = current
    current = null
    if (!section) return
    seen.add(section.id)
    entries.push({
      id: section.id,
      label: section.label,
      text: plainText(section.lines.join('\n')),
    })
  }

  for (const line of source.split('\n')) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line)
    if (!match) {
      current?.lines.push(line)
      continue
    }
    flush()
    const label = match[2].trim()
    const id = slugify(label)
    if (!id || seen.has(id)) continue
    current = { id, label, lines: [] }
  }

  flush()
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

/**
 * Split the rendered guide at h2 boundaries: everything before the first h2 is
 * the preamble (site title + tagline); each h2 opens one section slice.
 */
function splitGuideHtml(html: string): { preamble: string; sections: Map<string, string> } {
  const opens = [...html.matchAll(/<h2\b[^>]*>/g)]
  const firstIndex = opens[0]?.index ?? html.length
  const sections = new Map<string, string>()

  for (let i = 0; i < opens.length; i += 1) {
    const start = opens[i]?.index ?? html.length
    const end = i + 1 < opens.length ? (opens[i + 1]?.index ?? html.length) : html.length
    const id = /\bid="([^"]+)"/.exec(opens[i]?.[0] ?? '')?.[1] ?? ''
    if (!id || sections.has(id)) continue
    sections.set(id, html.slice(start, end))
  }

  return { preamble: html.slice(0, firstIndex), sections }
}

/** The section heading opens its own page, so it renders as the page h1. */
function sectionHeadingAsPageTitle(slice: string): string {
  return slice.replace(
    /^<h2\b([^>]*)>([\s\S]*?)<\/h2>/,
    (_match, attrs: string, inner: string) =>
      `<h1${attrs.replace(/\bclass="docs-h2"/, 'class="docs-title"')}>${inner}</h1>`,
  )
}

function validatePagePlan(sections: Map<string, string>): void {
  const inPlan = new Set<string>()
  for (const page of DOCS_PAGES) {
    if (page.sections.length === 0) {
      throw new Error(`Docs page "${page.slug}" lists no sections`)
    }
    for (const section of page.sections) {
      if (inPlan.has(section)) {
        throw new Error(`Docs section "${section}" is listed on more than one page`)
      }
      if (!sections.has(section)) {
        throw new Error(`guide.md has no "## ${section}" heading listed on docs page "${page.slug}"`)
      }
      inPlan.add(section)
    }
  }
  for (const id of sections.keys()) {
    if (!inPlan.has(id)) {
      throw new Error(`guide.md h2 "${id}" is missing from the DOCS_PAGES plan in src/docs/toc.ts`)
    }
  }
}

/**
 * In-document `#anchor` links become links to the page that owns the anchor.
 * h3 anchors keep their hash so they still land mid-page.
 */
function buildAnchorHrefs(sections: Map<string, string>): Map<string, string> {
  const hrefs = new Map<string, string>()
  const pageBySection = new Map<string, string>()
  for (const page of DOCS_PAGES) {
    for (const section of page.sections) {
      pageBySection.set(section, page.slug)
    }
  }
  for (const [sectionId, slice] of sections) {
    const slug = pageBySection.get(sectionId)
    if (!slug) continue
    hrefs.set(sectionId, slug === sectionId ? `/docs/${slug}` : `/docs/${slug}#${sectionId}`)
    for (const match of slice.matchAll(/<h3\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
      hrefs.set(match[1], `/docs/${slug}#${match[1]}`)
    }
  }
  return hrefs
}

function rewriteHashLinks(html: string, hrefs: Map<string, string>): string {
  return html.replace(/href="#([^"]*)"/g, (match, anchor: string) => {
    const target = hrefs.get(anchor)
    return target ? `href="${target}"` : match
  })
}

function buildDocsPageHtml(source: string): Record<string, string> {
  const pages: Record<string, string> = {}
  const { preamble, sections } = splitGuideHtml(renderGuideHtml(source))
  validatePagePlan(sections)
  const hrefs = buildAnchorHrefs(sections)

  DOCS_PAGES.forEach((page, index) => {
    const slices = page.sections.map((section) => sections.get(section) ?? '')
    const body = index === 0 ? slices.join('') : slices.map(sectionHeadingAsPageTitle).join('')
    const html = index === 0 ? `${preamble}${body}` : body
    pages[page.slug] = rewriteHashLinks(html, hrefs)
  })
  return pages
}

/** Per-page searchable text: the page's markdown slices, stripped to plain words. */
function buildDocsPageSearchTexts(source: string): Record<string, string> {
  const texts: Record<string, string> = {}
  const sections = new Map<string, string>()
  let preambleLines: string[] | null = null
  let currentLines: string[] | null = null
  let currentId = ''

  const flush = () => {
    if (currentId && currentLines) {
      const joined = sections.get(currentId) ?? ''
      sections.set(currentId, `${joined}\n${currentLines.join('\n')}`)
    } else if (currentLines) {
      preambleLines = currentLines
    }
  }

  for (const line of source.split('\n')) {
    const match = /^##\s+(.+)$/.exec(line)
    if (!match) {
      currentLines?.push(line)
      continue
    }
    flush()
    currentId = slugify(match[1])
    currentLines = [line]
  }
  flush()

  for (const page of DOCS_PAGES) {
    const parts = page.sections.map((section) => sections.get(section) ?? '')
    if (page === DOCS_PAGES[0] && preambleLines) {
      parts.unshift(preambleLines.join('\n'))
    }
    texts[page.slug] = plainText(parts.join('\n'))
  }
  return texts
}

function parseId(id: string): { filename: string; query: string } {
  const clean = id.split('\0')[0] ?? id
  const qIndex = clean.indexOf('?')
  if (qIndex === -1) return { filename: clean, query: '' }
  return { filename: clean.slice(0, qIndex), query: clean.slice(qIndex + 1) }
}

export function compileDocsGuide(): Plugin {
  let webOrigin = 'http://localhost:5173'

  return {
    name: 'compile-docs-guide',
    enforce: 'pre',
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir ?? config.root, '')
      webOrigin = 'http://localhost:5173'
      const configuredSiteUrl = firstNonEmpty(
        process.env.VITE_PUBLIC_SITE_URL,
        env.VITE_PUBLIC_SITE_URL,
      )
      if (configuredSiteUrl) {
        try {
          webOrigin = new URL(normalizeSiteUrl(configuredSiteUrl)).origin
        } catch {
          webOrigin = 'http://localhost:5173'
        }
      }
    },
    load(id) {
      const { filename, query } = parseId(id)
      if (!filename.endsWith('guide.md')) return
      if (
        query !== 'html' &&
        query !== 'search' &&
        query !== 'pages' &&
        query !== 'page-search'
      ) {
        return
      }

      const source = readFileSync(filename, 'utf8')
        .replaceAll('{{APP_NAME}}', APP_NAME)
        .replaceAll('{{API_BASE}}', 'http://localhost:3000')
        .replaceAll('{{WEB_ORIGIN}}', webOrigin)

      if (query === 'html') {
        return `export default ${JSON.stringify(renderGuideHtml(source))}`
      }
      if (query === 'pages') {
        return `export default ${JSON.stringify(buildDocsPageHtml(source))}`
      }
      if (query === 'page-search') {
        return `export default ${JSON.stringify(buildDocsPageSearchTexts(source))}`
      }
      return `export default ${JSON.stringify(buildSearchIndex(source))}`
    },
  }
}
