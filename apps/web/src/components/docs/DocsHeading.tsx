import type { ReactNode } from 'react'

type DocsHeadingProps = {
  id: string
  level: 2 | 3
  children: ReactNode
}

export function DocsHeading({ id, level, children }: DocsHeadingProps) {
  if (level === 2) {
    return (
      <h2 id={id} className="docs-v2-h2">
        {children}
      </h2>
    )
  }
  return (
    <h3 id={id} className="docs-v2-h3">
      {children}
    </h3>
  )
}
