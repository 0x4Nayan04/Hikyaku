import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import {
  highlightCode,
  inferHighlightLanguage,
  type HighlightLanguage,
} from '@/lib/highlight-code'
import { toast } from '@/lib/toast'

type DocsCodeBlockProps = {
  label: string
  code: string
  language?: HighlightLanguage
}

export function DocsCodeBlock({ label, code, language }: DocsCodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolvedLanguage = language ?? inferHighlightLanguage(label, code)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Copied to clipboard')
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy')
    }
  }, [code])

  return (
    <div className="docs-v2-code">
      <div className="docs-v2-code-head">
        <span className="docs-v2-code-label">{label}</span>
        <button
          type="button"
          className="docs-v2-code-copy focus-ring"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : `Copy ${label}`}
        >
          {copied ? (
            <Check className="size-3" aria-hidden="true" />
          ) : (
            <Copy className="size-3" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="docs-v2-code-body">
        <code>{highlightCode(code, resolvedLanguage)}</code>
      </pre>
    </div>
  )
}
