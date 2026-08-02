import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from '@/lib/toast'

type AttemptResponseBodyProps = {
  body: string
}

export function AttemptResponseBody({ body }: AttemptResponseBodyProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(body)
    toast.success('Response copied')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="mt-3 overflow-hidden rounded-none border border-border bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-1.5">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-strong">
          Response body
        </p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex h-6 items-center gap-1 rounded-none px-1.5 text-[0.6875rem] font-medium text-muted-strong hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3" aria-hidden="true" />
          ) : (
            <Copy className="size-3" aria-hidden="true" />
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed text-foreground">
        {body}
      </pre>
    </div>
  )
}
