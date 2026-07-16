import type { ReactNode } from 'react'

type DocsTableProps = {
  label?: string
  children: ReactNode
}

export function DocsTable({ label, children }: DocsTableProps) {
  return (
    <div className="docs-v2-table-wrap">
      <div className="docs-v2-table-scroll">
        <table className="docs-v2-table" aria-label={label}>
          {children}
        </table>
      </div>
    </div>
  )
}
