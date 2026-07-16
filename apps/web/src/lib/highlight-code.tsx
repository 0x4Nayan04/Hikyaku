import type { ReactNode } from 'react'

export type HighlightLanguage = 'bash' | 'json' | 'javascript' | 'python' | 'http' | 'text'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function span(className: string, text: string): ReactNode {
  return <span className={className}>{text}</span>
}

function highlightBash(code: string): ReactNode[] {
  const lines = code.split('\n')
  return lines.map((line, lineIndex) => {
    const parts: ReactNode[] = []
    let rest = line

    if (rest.startsWith('curl ')) {
      parts.push(span('hl-cmd', 'curl'))
      rest = rest.slice(4)
    }

    const flagRegex = /(\s)(-\w+|--[\w-]+)/g
    let lastIndex = 0
    let match: RegExpExecArray | null
    const segments: Array<{ start: number; end: number; kind: 'flag' | 'string' }> = []

    const stringRegex = /('[^']*'|"[^"]*")/g
    while ((match = stringRegex.exec(rest)) !== null) {
      segments.push({ start: match.index, end: match.index + match[0].length, kind: 'string' })
    }

    while ((match = flagRegex.exec(rest)) !== null) {
      const overlaps = segments.some(
        (segment) => match!.index >= segment.start && match!.index < segment.end,
      )
      if (!overlaps) {
        segments.push({ start: match.index + match[1].length, end: match.index + match[0].length, kind: 'flag' })
      }
    }

    segments.sort((a, b) => a.start - b.start)

    for (const segment of segments) {
      if (segment.start > lastIndex) {
        parts.push(rest.slice(lastIndex, segment.start))
      }
      const text = rest.slice(segment.start, segment.end)
      parts.push(span(segment.kind === 'flag' ? 'hl-flag' : 'hl-string', text))
      lastIndex = segment.end
    }

    if (lastIndex < rest.length) {
      parts.push(rest.slice(lastIndex))
    }

    return (
      <span key={lineIndex} className="hl-line">
        {parts.length > 0 ? parts : line}
        {lineIndex < lines.length - 1 ? '\n' : null}
      </span>
    )
  })
}

function highlightJson(code: string): ReactNode[] {
  const tokenRegex =
    /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(code.slice(lastIndex, match.index))
    }
    if (match[1]) {
      nodes.push(span('hl-key', match[1]))
      nodes.push(':')
    } else if (match[2]) {
      nodes.push(span('hl-string', match[2]))
    } else if (match[3]) {
      nodes.push(span('hl-keyword', match[3]))
    } else {
      nodes.push(span('hl-number', match[0]))
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < code.length) {
    nodes.push(code.slice(lastIndex))
  }

  return nodes
}

function highlightJavascript(code: string): ReactNode[] {
  const tokenRegex =
    /(\/\/.*$|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|\b(import|from|const|let|var|function|return|new|typeof)\b/gm
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(code.slice(lastIndex, match.index))
    }
    if (match[1]) {
      nodes.push(span('hl-comment', match[1]))
    } else if (match[2]) {
      nodes.push(span('hl-string', match[2]))
    } else if (match[3]) {
      nodes.push(span('hl-keyword', match[3]))
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < code.length) {
    nodes.push(code.slice(lastIndex))
  }

  return nodes
}

function highlightPython(code: string): ReactNode[] {
  const tokenRegex =
    /(#.*$)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|\b(import|from|def|return|True|False|None)\b/gm
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(code.slice(lastIndex, match.index))
    }
    if (match[1]) {
      nodes.push(span('hl-comment', match[1]))
    } else if (match[2]) {
      nodes.push(span('hl-string', match[2]))
    } else if (match[3]) {
      nodes.push(span('hl-keyword', match[3]))
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < code.length) {
    nodes.push(code.slice(lastIndex))
  }

  return nodes
}

function highlightHttp(code: string): ReactNode[] {
  return code.split('\n').map((line, index) => {
    const colon = line.indexOf(':')
    if (colon > 0) {
      return (
        <span key={index} className="hl-line">
          {span('hl-key', line.slice(0, colon + 1))}
          {line.slice(colon + 1)}
          {index < code.split('\n').length - 1 ? '\n' : null}
        </span>
      )
    }
    return (
      <span key={index} className="hl-line">
        {line}
        {index < code.split('\n').length - 1 ? '\n' : null}
      </span>
    )
  })
}

export function highlightCode(code: string, language: HighlightLanguage): ReactNode {
  switch (language) {
    case 'bash':
      return <>{highlightBash(code)}</>
    case 'json':
      return <>{highlightJson(code)}</>
    case 'javascript':
      return <>{highlightJavascript(code)}</>
    case 'python':
      return <>{highlightPython(code)}</>
    case 'http':
      return <>{highlightHttp(code)}</>
    case 'text':
      return escapeHtml(code)
    default: {
      const _exhaustive: never = language
      return _exhaustive
    }
  }
}

export function inferHighlightLanguage(label: string, code: string): HighlightLanguage {
  const normalized = label.toLowerCase()
  if (normalized.includes('curl') || code.trimStart().startsWith('curl ')) return 'bash'
  if (normalized.includes('node') || code.includes('import crypto')) return 'javascript'
  if (normalized.includes('python') || code.includes('def ')) return 'python'
  if (normalized.includes('header') || code.includes('Content-Type:')) return 'http'
  if (code.trimStart().startsWith('{') || code.trimStart().startsWith('[')) return 'json'
  return 'text'
}
