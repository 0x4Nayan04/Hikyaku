import { useEffect, useRef } from 'react'

import guideHtml from '@/docs/guide.md?html'
import { copyToClipboard } from '@/lib/clipboard'
import { COPY_FEEDBACK_MS } from '@/lib/ui-timing'

export function DocsPage() {
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = articleRef.current
    if (!root) return

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest('.docs-code-copy')
      if (!(button instanceof HTMLButtonElement)) return

      const code = button.closest('.docs-code')?.querySelector('pre')?.textContent ?? ''
      void copyToClipboard(code, 'Code').then((ok) => {
        if (!ok) return
        button.textContent = 'Copied'
        button.setAttribute('aria-label', 'Copied code')
        window.setTimeout(() => {
          button.textContent = 'Copy'
          button.setAttribute('aria-label', 'Copy code')
        }, COPY_FEEDBACK_MS)
      })
    }

    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [])

  return (
    <article
      ref={articleRef}
      className="docs-article"
      dangerouslySetInnerHTML={{ __html: guideHtml }}
    />
  )
}
