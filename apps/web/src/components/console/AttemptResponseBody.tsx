import { useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'

type BodyKind = 'json' | 'html' | 'text'

type AttemptResponseBodyProps = {
  body: string
}

function classifyBody(body: string): BodyKind {
  const trimmed = body.trim()
  if (trimmed.startsWith('<') && /<\/?[a-z]/i.test(trimmed)) {
    return 'html'
  }
  try {
    JSON.parse(trimmed)
    return 'json'
  } catch {
    return 'text'
  }
}

function expandNestedJson(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return expandNestedJson(JSON.parse(trimmed) as unknown)
      } catch {
        return value
      }
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map(expandNestedJson)
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, expandNestedJson(nested)]),
    )
  }

  return value
}

function formatJsonBody(body: string): string | null {
  try {
    return JSON.stringify(expandNestedJson(JSON.parse(body) as unknown), null, 2)
  } catch {
    return null
  }
}

function extractHtmlTitle(body: string): string | null {
  const match = body.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = match?.[1]?.trim()
  return title || null
}

function highlightJson(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],]|:/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const [token, stringToken, keyColon, literal] = match
    if (stringToken !== undefined) {
      nodes.push(
        <span
          key={match.index}
          className={keyColon !== undefined ? 'text-foreground' : 'text-status-info'}
        >
          {stringToken}
          {keyColon ?? ''}
        </span>,
      )
    } else if (literal !== undefined) {
      nodes.push(
        <span key={match.index} className="text-status-warning">
          {token}
        </span>,
      )
    } else if (/^-?\d/.test(token)) {
      nodes.push(
        <span key={match.index} className="text-status-success">
          {token}
        </span>,
      )
    } else {
      nodes.push(
        <span key={match.index} className="text-muted-foreground">
          {token}
        </span>,
      )
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

async function copyResponse(value: string) {
  await navigator.clipboard.writeText(value)
  toast.success('Response copied')
}

export function AttemptResponseBody({ body }: AttemptResponseBodyProps) {
  const kind = useMemo(() => classifyBody(body), [body])
  const formattedJson = useMemo(
    () => (kind === 'json' ? formatJsonBody(body) : null),
    [body, kind],
  )
  const canFormat = Boolean(formattedJson && formattedJson !== body)
  const htmlTitle = useMemo(
    () => (kind === 'html' ? extractHtmlTitle(body) : null),
    [body, kind],
  )

  const [view, setView] = useState<'formatted' | 'raw'>(canFormat ? 'formatted' : 'raw')
  const [expanded, setExpanded] = useState(false)
  const [htmlOpen, setHtmlOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const displayBody = view === 'formatted' && formattedJson ? formattedJson : body
  const lineCount = displayBody.split('\n').length
  const isLong = displayBody.length > 900 || lineCount > 16
  const showHighlighted = kind === 'json' && view === 'formatted' && formattedJson !== null

  async function handleCopy() {
    await copyResponse(view === 'formatted' && formattedJson ? formattedJson : body)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (kind === 'html' && !htmlOpen) {
    return (
      <div className="mt-3 rounded-none border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">HTML response</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {htmlTitle ?? 'Endpoint returned an HTML document'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ToolbarButton onClick={() => void handleCopy()} label={copied ? 'Copied' : 'Copy'}>
              {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
            </ToolbarButton>
            <ToolbarButton onClick={() => setHtmlOpen(true)} label="Show response">
              <ChevronDown className="size-3" aria-hidden="true" />
            </ToolbarButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 overflow-hidden rounded-none border border-border bg-muted/30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-1.5">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-strong">
          {kind === 'json' ? 'Response body' : kind === 'html' ? 'HTML response' : 'Response body'}
        </p>
        <div className="flex items-center gap-1">
          {canFormat ? (
            <>
              <ViewToggle
                active={view === 'formatted'}
                onClick={() => setView('formatted')}
                label="Formatted"
              />
              <ViewToggle active={view === 'raw'} onClick={() => setView('raw')} label="Raw" />
            </>
          ) : null}
          {kind === 'html' ? (
            <ToolbarButton onClick={() => setHtmlOpen(false)} label="Hide">
              <ChevronUp className="size-3" aria-hidden="true" />
            </ToolbarButton>
          ) : null}
          <ToolbarButton onClick={() => void handleCopy()} label={copied ? 'Copied' : 'Copy'}>
            {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
          </ToolbarButton>
        </div>
      </div>

      <pre
        className={cn(
          'overflow-x-hidden whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed text-foreground',
          expanded || !isLong ? 'max-h-none' : 'max-h-64 overflow-y-auto',
        )}
      >
        {showHighlighted ? highlightJson(displayBody) : displayBody}
      </pre>

      {isLong ? (
        <div className="border-t border-border/70 px-3 py-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-muted-strong hover:text-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3" aria-hidden="true" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="size-3" aria-hidden="true" />
                Show more
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ToolbarButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 items-center gap-1 rounded-none px-1.5 text-[0.6875rem] font-medium text-muted-strong hover:bg-muted hover:text-foreground"
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

function ViewToggle({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-6 items-center rounded-none px-1.5 text-[0.6875rem] font-medium',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-strong hover:bg-muted/70 hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
